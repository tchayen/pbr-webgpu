import { createBuffer } from "./createBuffer";
import { Mat4 } from "./math/Mat4";
import { HDRData } from "./parseHDR";
import {
  cubeVertexArray,
  cubemapVertexShader,
  cubemapViewMatrices,
} from "./cubemapShared";

/**
 * This function takes URL of HDR equirectangular image and renders it to a
 * cubemap texture.
 */
export function renderToCubemap(device: GPUDevice, hdr: HDRData, size: number) {
  const cubemapVerticesBuffer = createBuffer(
    device,
    cubeVertexArray,
    GPUBufferUsage.VERTEX,
  );

  const cubemapTexture = device.createTexture({
    label: "cubemap from equirectangular",
    dimension: "2d",
    size: { width: size, height: size, depthOrArrayLayers: 6 },
    format: "rgba8unorm",
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const equirectangularTexture = device.createTexture({
    label: "source equirectangular texture",
    size: { width: hdr.width, height: hdr.height },
    format: "rgba16float",
    usage:
      GPUTextureUsage.RENDER_ATTACHMENT |
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST,
  });

  device.queue.writeTexture(
    { texture: equirectangularTexture },
    hdr.data.buffer,
    { bytesPerRow: 8 * hdr.width },
    { width: hdr.width, height: hdr.height },
  );

  const depthTexture = device.createTexture({
    label: "cubemap depth texture",
    size: { width: size, height: size },
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const depthTextureView = depthTexture.createView();

  const fragmentShader = /* wgsl */ `
@group(0) @binding(1) var ourTexture: texture_2d<f32>;
@group(0) @binding(2) var ourSampler: sampler;

const invAtan = vec2f(0.1591, 0.3183);

fn sampleSphericalMap(v: vec3f) -> vec2f {
  var uv = vec2f(atan2(v.z, v.x), asin(v.y));
  uv *= invAtan;
  uv += 0.5;
  return uv;
}

@fragment
fn main(@location(0) worldPosition: vec4f) -> @location(0) vec4f {
  let uv = sampleSphericalMap(normalize(worldPosition.xyz));
  var color = textureSample(ourTexture, ourSampler, uv).rgb;
  return vec4f(color, 1);
}
`;

  const pipelinePipeline = device.createRenderPipeline({
    label: "renderToCubemap",
    layout: "auto",
    vertex: {
      module: device.createShaderModule({ code: cubemapVertexShader }),
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

  const sampler = device.createSampler({
    label: "convert equirectangular to cubemap",
    magFilter: "linear",
    minFilter: "linear",
  });

  const uniformBuffer = device.createBuffer({
    size: Float32Array.BYTES_PER_ELEMENT * 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const bindGroup = device.createBindGroup({
    label: "transform bind group",
    layout: pipelinePipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: uniformBuffer,
          offset: 0,
          size: Float32Array.BYTES_PER_ELEMENT * 16,
        },
      },
      {
        binding: 1,
        resource: equirectangularTexture.createView(),
      },
      {
        binding: 2,
        resource: sampler,
      },
    ],
  });

  const projection = Mat4.perspective(Math.PI / 2, 1, 0.1, 10);

  for (let i = 0; i < 6; i++) {
    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass({
      label: "equirectangular to cubemap",
      colorAttachments: [
        {
          view: cubemapTexture.createView({
            baseArrayLayer: i,
            arrayLayerCount: 1,
          }),
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

    const view = cubemapViewMatrices[i];
    const modelViewProjectionMatrix = view.multiply(projection).data;

    device.queue.writeBuffer(
      uniformBuffer,
      0,
      new Float32Array(modelViewProjectionMatrix).buffer,
    );

    passEncoder.setPipeline(pipelinePipeline);
    passEncoder.setViewport(0, 0, size, size, 0, 1);
    passEncoder.setVertexBuffer(0, cubemapVerticesBuffer);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.draw(36);
    passEncoder.end();

    device.queue.submit([commandEncoder.finish()]);
  }

  return cubemapTexture;
}
