import { cubeVertexArray, cubemapViewMatricesInverted } from "./cubemapShared";
import { createBuffer } from "./createBuffer";
import { Mat4 } from "./math/Mat4";
import {
  distributionGGX,
  hammersley,
  importanceSampleGGX,
  radicalInverseVdC,
} from "./pbrShaderFunctions";

export function getPrefilterMap(
  device: GPUDevice,
  cubemapTexture: GPUTexture,
  size: number,
  levels: number,
) {
  const prefilterTexture = device.createTexture({
    label: "prefilter map",
    dimension: "2d",
    size: {
      width: size,
      height: size,
      depthOrArrayLayers: 6,
    },
    format: "rgba8unorm",
    mipLevelCount: levels,
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const depthTexture = device.createTexture({
    label: "prefilter map depth",
    size: { width: size, height: size },
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
    mipLevelCount: levels,
  });

  // Like `cubemapVertexShader` but with roughness.
  const vertexShader = /* wgsl */ `
struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) worldPosition: vec4f,
};

struct Uniforms {
  modelViewProjectionMatrix: mat4x4f,
  roughness: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn main(@location(0) position: vec4f) -> VSOut {
  var output: VSOut;
  output.position = uniforms.modelViewProjectionMatrix * position;
  output.worldPosition = position;
  return output;
}
`;

  const fragmentShader = /* wgsl */ `
struct Uniforms {
  modelViewProjectionMatrix: mat4x4f,
  roughness: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var environmentMap: texture_cube<f32>;
@group(0) @binding(2) var environmentSampler: sampler;

const PI = 3.14159265359;

${distributionGGX}
${radicalInverseVdC}
${hammersley}
${importanceSampleGGX}

@fragment
fn main(@location(0) worldPosition: vec4f) -> @location(0) vec4f {
  var n = normalize(worldPosition.xyz);

  // Make the simplifying assumption that V equals R equals the normal
  let r = n;
  let v = r;

  let SAMPLE_COUNT: u32 = 4096u;
  var prefilteredColor = vec3f(0.0, 0.0, 0.0);
  var totalWeight = 0.0;

  for (var i: u32 = 0u; i < SAMPLE_COUNT; i = i + 1u) {
    // Generates a sample vector that's biased towards the preferred alignment
    // direction (importance sampling).
    let xi = hammersley(i, SAMPLE_COUNT);
    let h = importanceSampleGGX(xi, n, uniforms.roughness);
    let l = normalize(2.0 * dot(v, h) * h - v);

    let nDotL = max(dot(n, l), 0.0);

    if(nDotL > 0.0) {
      // sample from the environment's mip level based on roughness/pdf
      let d = distributionGGX(n, h, uniforms.roughness);
      let nDotH = max(dot(n, h), 0.0);
      let hDotV = max(dot(h, v), 0.0);
      let pdf = d * nDotH / (4.0 * hDotV) + 0.0001;

      let resolution = ${size}.0; // resolution of source cubemap (per face)
      let saTexel = 4.0 * PI / (6.0 * resolution * resolution);
      let saSample = 1.0 / (f32(SAMPLE_COUNT) * pdf + 0.0001);

      let mipLevel = select(0.5 * log2(saSample / saTexel), 0.0, uniforms.roughness == 0.0);

      prefilteredColor += textureSampleLevel(environmentMap, environmentSampler, l, mipLevel).rgb * nDotL;
      totalWeight += nDotL;
    }
  }

  prefilteredColor = prefilteredColor / totalWeight;
  return vec4f(prefilteredColor, 1.0);
}
`;

  const verticesBuffer = createBuffer(
    device,
    cubeVertexArray,
    GPUBufferUsage.VERTEX,
  );

  const sampler = device.createSampler({
    label: "prefilter map",
    magFilter: "linear",
    minFilter: "linear",
  });

  const uniformBuffer = device.createBuffer({
    // This has to be padded so 4 not 1.
    size: Float32Array.BYTES_PER_ELEMENT * (16 + 4),
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const pipeline = device.createRenderPipeline({
    label: "prefilter map",
    layout: "auto",
    vertex: {
      module: device.createShaderModule({ code: vertexShader }),
      entryPoint: "main",
      buffers: [
        {
          arrayStride: Float32Array.BYTES_PER_ELEMENT * 4,
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "float32x4",
            },
          ],
        },
      ],
    },
    fragment: {
      module: device.createShaderModule({ code: fragmentShader }),
      entryPoint: "main",
      targets: [{ format: "rgba8unorm" }],
    },
    primitive: {
      topology: "triangle-list",
    },
    depthStencil: {
      format: "depth24plus",
      depthWriteEnabled: true,
      depthCompare: "less",
    },
  });

  const projection = Mat4.perspective(Math.PI / 2, 1, 0.1, 10);

  for (let mip = 0; mip < levels; mip++) {
    const width = prefilterTexture.width >> mip;
    const height = prefilterTexture.height >> mip;

    const roughness = mip / (levels - 1);

    const bindGroup = device.createBindGroup({
      label: "prefilter map",
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: uniformBuffer,
            offset: 0,
            size: Float32Array.BYTES_PER_ELEMENT * (16 + 4),
          },
        },
        {
          binding: 1,
          resource: cubemapTexture.createView({ dimension: "cube" }),
        },
        {
          binding: 2,
          resource: sampler,
        },
      ],
    });

    const depthTextureView = depthTexture.createView({
      baseMipLevel: mip,
      mipLevelCount: 1,
    });

    for (let i = 0; i < 6; i++) {
      const commandEncoder = device.createCommandEncoder({
        label: "prefilter map",
      });
      const passEncoder = commandEncoder.beginRenderPass({
        label: "prefilter map",
        colorAttachments: [
          {
            view: prefilterTexture.createView({
              baseArrayLayer: i,
              arrayLayerCount: 1,
              baseMipLevel: mip,
              mipLevelCount: 1,
            }),
            clearValue: [0.3, 0.3, 0.3, 1],
            loadOp: "load",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: depthTextureView,
          depthClearValue: 1.0,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });

      const view = cubemapViewMatricesInverted[i];
      const modelViewProjectionMatrix = view.multiply(projection).data;

      device.queue.writeBuffer(
        uniformBuffer,
        0,
        // Zeroes are for padding.
        new Float32Array([...modelViewProjectionMatrix, roughness, 0, 0, 0])
          .buffer,
      );

      passEncoder.setPipeline(pipeline);
      passEncoder.setViewport(0, 0, width, height, 0, 1);
      passEncoder.setVertexBuffer(0, verticesBuffer);
      passEncoder.setBindGroup(0, bindGroup);
      passEncoder.draw(36);
      passEncoder.end();

      device.queue.submit([commandEncoder.finish()]);
    }
  }

  return prefilterTexture;
}
