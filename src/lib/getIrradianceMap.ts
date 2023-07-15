import { Mat4 } from "./math/Mat4";
import {
  cubeVertexArray,
  cubemapVertexShader,
  cubemapViewMatricesInverted,
} from "./cubemapShared";
import { createBuffer } from "./createBuffer";

export function getIrradianceMap(
  device: GPUDevice,
  cubemapTexture: GPUTexture,
  size: number,
) {
  const irradianceTexture = device.createTexture({
    label: "irradiance map",
    dimension: "2d",
    size: {
      width: size,
      height: size,
      depthOrArrayLayers: 6,
    },
    format: "rgba8unorm",
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const depthTexture = device.createTexture({
    label: "irradiance map depth",
    size: { width: size, height: size },
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const depthTextureView = depthTexture.createView();

  const fragmentShader = /* wgsl */ `
  @group(0) @binding(1) var environmentMap: texture_cube<f32>;
  @group(0) @binding(2) var ourSampler: sampler;

  const PI = 3.14159265359;

  @fragment
  fn main(@location(0) worldPosition: vec4f) -> @location(0) vec4f {
    let normal = normalize(worldPosition.xyz);
    var irradiance = vec3f(0.0, 0.0, 0.0);

    var up = vec3f(0.0, 1.0, 0.0);
    let right = normalize(cross(up, normal));
    up = normalize(cross(normal, right));

    var sampleDelta = 0.025;
    var nrSamples = 0.0;
    for(var phi: f32 = 0.0; phi < 2.0 * PI; phi = phi + sampleDelta) {
      for(var theta : f32 = 0.0; theta < 0.5 * PI; theta = theta + sampleDelta) {
        // spherical to cartesian (in tangent space)
        let tangentSample: vec3f = vec3f(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta));
        // tangent space to world
        let sampleVec = tangentSample.x * right + tangentSample.y * up + tangentSample.z * normal;

        irradiance = irradiance + textureSample(environmentMap, ourSampler, sampleVec).rgb * cos(theta) * sin(theta);
        nrSamples = nrSamples + 1.0;
      }
    }
    irradiance = PI * irradiance * (1.0 / nrSamples);

    return vec4f(irradiance, 1.0);
  }
  `;

  const verticesBuffer = createBuffer(
    device,
    cubeVertexArray,
    GPUBufferUsage.VERTEX,
  );

  const sampler = device.createSampler({
    label: "irradiance map",
    magFilter: "linear",
    minFilter: "linear",
  });

  const uniformBuffer = device.createBuffer({
    size: Float32Array.BYTES_PER_ELEMENT * 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const pipeline = device.createRenderPipeline({
    label: "irradiance map",
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

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
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
        resource: cubemapTexture.createView({ dimension: "cube" }),
      },
      {
        binding: 2,
        resource: sampler,
      },
    ],
  });

  const projection = Mat4.perspective(Math.PI / 2, 1, 0.1, 10);

  for (let i = 0; i < 6; i += 1) {
    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: irradianceTexture.createView({
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

    const view = cubemapViewMatricesInverted[i];
    const modelViewProjectionMatrix = view.multiply(projection).data;

    device.queue.writeBuffer(
      uniformBuffer,
      0,
      new Float32Array(modelViewProjectionMatrix).buffer,
    );

    passEncoder.setPipeline(pipeline);
    passEncoder.setViewport(0, 0, size, size, 0, 1);
    passEncoder.setVertexBuffer(0, verticesBuffer);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.draw(36);
    passEncoder.end();

    device.queue.submit([commandEncoder.finish()]);
  }

  return irradianceTexture;
}
