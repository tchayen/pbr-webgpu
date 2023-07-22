import { invariant } from "./invariant";

export class MipmapGenerator {
  sampler: GPUSampler;
  pipelineMap: Map<GPUTextureFormat, GPURenderPipeline> = new Map();

  constructor(private device: GPUDevice) {
    this.sampler = this.device.createSampler({
      label: "mip generator",
      minFilter: "linear",
    });
  }

  getPipeline(format: GPUTextureFormat) {
    if (this.pipelineMap.has(format)) {
      return this.pipelineMap.get(format);
    }

    const module = this.device.createShaderModule({
      label: "textured quad shaders for mip level generation",
      code: /* wgsl */ `
        struct VSOutput {
          @builtin(position) position: vec4f,
          @location(0) uv: vec2f,
        };

        @vertex fn vs(
          @builtin(vertex_index) vertexIndex: u32
        ) -> VSOutput {
          var pos = array<vec2f, 6>(
            vec2f(0.0,  0.0), // center
            vec2f(1.0,  0.0), // right, center
            vec2f(0.0,  1.0), // center, top

            vec2f(0.0,  1.0), // center, top
            vec2f(1.0,  0.0), // right, center
            vec2f(1.0,  1.0), // right, top
          );

          var vsOutput: VSOutput;
          let xy = pos[vertexIndex];
          vsOutput.position = vec4f(xy * 2.0 - 1.0, 0.0, 1.0);
          vsOutput.uv = vec2f(xy.x, 1.0 - xy.y);
          return vsOutput;
        }

        @group(0) @binding(0) var ourSampler: sampler;
        @group(0) @binding(1) var ourTexture: texture_2d<f32>;

        @fragment fn fs(fsInput: VSOutput) -> @location(0) vec4f {
          return textureSample(ourTexture, ourSampler, fsInput.uv);
        }
      `,
    });

    const pipeline = this.device.createRenderPipeline({
      label: "mip level generator",
      layout: "auto",
      vertex: {
        module,
        entryPoint: "vs",
      },
      fragment: {
        module,
        entryPoint: "fs",
        targets: [{ format }],
      },
    });

    this.pipelineMap.set(format, pipeline);

    return pipeline;
  }

  generateMipmaps(texture: GPUTexture) {
    if (texture.dimension == "3d" || texture.dimension == "1d") {
      throw new Error(
        "Generating mipmaps for non-2d textures is currently unsupported!"
      );
    }

    const encoder = this.device.createCommandEncoder({
      label: "mip gen encoder",
    });

    const pipeline = this.getPipeline(texture.format);
    invariant(pipeline, "No pipeline found for texture format.");

    let width = texture.width;
    let height = texture.height;
    let currentMipLevel = 0;

    while (width > 1 || height > 1) {
      width = Math.max(1, (width / 2) | 0);
      height = Math.max(1, (height / 2) | 0);

      const bindGroup = this.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: this.sampler },
          {
            binding: 1,
            resource: texture.createView({
              baseMipLevel: currentMipLevel,
              mipLevelCount: 1,
            }),
          },
        ],
      });

      currentMipLevel += 1;

      const pass = encoder.beginRenderPass({
        label: "our basic canvas renderPass",
        colorAttachments: [
          {
            view: texture.createView({
              baseMipLevel: currentMipLevel,
              mipLevelCount: 1,
            }),
            clearValue: [0.3, 0.3, 0.3, 1],
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(6);
      pass.end();
    }

    const commandBuffer = encoder.finish();
    this.device.queue.submit([commandBuffer]);
  }
}
