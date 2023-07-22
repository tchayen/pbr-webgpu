import { invariant } from "./lib/invariant";
import {
  GLTFDescriptor,
  GLTFMaterialDescriptor,
  GLTFNodeDescriptor,
  GLTFPrimitiveDescriptor,
} from "./lib/gltfTypes";
import { alignTo } from "./alignTo";
import { Mat4 } from "./lib/math/Mat4";
import { Camera } from "./lib/Camera";
import { Vec4 } from "./lib/math/Vec4";
import {
  packedArrayStrideForAccessor,
  gpuFormatForAccessor,
  gpuIndexFormatForComponentType,
  createSolidColorTexture,
  createDefaultSampler,
  createSampler,
} from "./lib/gltfUtils";
import { wgsl } from "./lib/wgslPreprocessor";

const ShaderLocations: Record<string, number> = {
  POSITION: 0,
  NORMAL: 1,
  TEXCOORD_0: 2,
};

const SAMPLE_COUNT = 4;

type TODO = any;

type Material = {
  bindGroup: GPUBindGroup;
};

type GpuPrimitive = {
  pipeline: GPURenderPipeline;
  buffers: {
    buffer: GPUBuffer;
    offset: number;
  }[];
  instances: { first: number; count: number };
  indexBuffer: GPUBuffer;
  indexOffset: number;
  indexType: GPUIndexFormat;
  drawCount: number;
  material: Material;
};

type NodeGpuData = {
  bindGroup: GPUBindGroup;
};

type PrimitiveInstances = {
  matrices: Map<GLTFPrimitiveDescriptor, Mat4[]>;
  total: number;
  arrayBuffer: Float32Array | null;
  offset: number;
};

export class GLTFRenderer {
  pipelineGpuData = new Map<
    string,
    {
      pipeline: GPURenderPipeline;
      primitives: GpuPrimitive[];
    }
  >();

  primitiveGpuData = new Map<GLTFPrimitiveDescriptor, GpuPrimitive>();
  nodeGpuData = new Map<GLTFNodeDescriptor, NodeGpuData>();
  textures: { texture: GPUTexture; sampler: GPUSampler }[] = [];

  cameraBindGroupLayout: GPUBindGroupLayout;
  instanceBindGroupLayout: GPUBindGroupLayout;
  pipelineLayout: GPUPipelineLayout;
  cameraUniformBuffer: GPUBuffer;
  cameraBindGroup: GPUBindGroup;

  shaderModules: Map<string, GPUShaderModule> = new Map();

  camera: Camera;
  depthTexture: GPUTexture;
  depthTextureView: GPUTextureView;
  colorTexture: GPUTexture;
  colorTextureView: GPUTextureView;

  // Maps node to a parent.
  nodeParents = new Map<GLTFNodeDescriptor, GLTFNodeDescriptor>();

  // Maps node to its transform.
  nodeTransforms = new Map<GLTFNodeDescriptor, Mat4>();
  instanceBindGroup: GPUBindGroup;

  defaultSampler: GPUSampler;
  opaqueWhiteTexture: GPUTexture;
  transparentBlackTexture: GPUTexture;
  defaultNormalTexture: GPUTexture;
  materialBindGroupLayout: GPUBindGroupLayout;

  constructor(
    private device: GPUDevice,
    private gltf: GLTFDescriptor,
    private canvas: HTMLCanvasElement,
    private context: GPUCanvasContext,
    textures: GPUTexture[]
  ) {
    this.render = this.render.bind(this);

    this.camera = new Camera(0, 0);

    this.opaqueWhiteTexture = createSolidColorTexture(this.device, 1, 1, 1, 1);
    this.transparentBlackTexture = createSolidColorTexture(
      this.device,
      0,
      0,
      0,
      0
    );
    this.defaultNormalTexture = createSolidColorTexture(
      this.device,
      0.5,
      0.5,
      1,
      1
    );
    this.defaultSampler = createDefaultSampler(this.device);

    this.instanceBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "read-only-storage" },
        },
      ],
    });

    this.cameraBindGroupLayout = this.device.createBindGroupLayout({
      label: `Frame BindGroupLayout`,
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {},
        },
      ],
    });

    this.materialBindGroupLayout = this.device.createBindGroupLayout({
      label: `glTF Material BindGroupLayout`,
      entries: [
        {
          binding: 0, // Material uniforms
          visibility: GPUShaderStage.FRAGMENT,
          buffer: {},
        },
        {
          binding: 1, // Texture sampler
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        },
        {
          binding: 2, // BaseColor texture
          visibility: GPUShaderStage.FRAGMENT,
          texture: {},
        },
      ],
    });

    this.pipelineLayout = this.device.createPipelineLayout({
      label: "glTF Pipeline Layout",
      bindGroupLayouts: [
        this.cameraBindGroupLayout,
        this.instanceBindGroupLayout,
        this.materialBindGroupLayout,
      ],
    });

    this.cameraUniformBuffer = this.device.createBuffer({
      size: Float32Array.BYTES_PER_ELEMENT * 36,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.cameraBindGroup = this.device.createBindGroup({
      label: `Frame BindGroup`,
      layout: this.cameraBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.cameraUniformBuffer },
        },
      ],
    });

    const primitiveInstances: PrimitiveInstances = {
      matrices: new Map(),
      total: 0,
      arrayBuffer: null,
      offset: 0,
    };

    // Set up node transforms.
    for (const node of gltf.nodes) {
      this.nodeTransforms.set(node, this.getTRS(node));
      if (node.children) {
        for (const child of node.children) {
          this.nodeParents.set(this.gltf.nodes[child], node);
        }
      }
    }

    for (const node of gltf.nodes) {
      this.setupNode(node, primitiveInstances);
    }

    const instanceBuffer = this.device.createBuffer({
      size: 16 * Float32Array.BYTES_PER_ELEMENT * primitiveInstances.total,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });

    primitiveInstances.arrayBuffer = new Float32Array(
      instanceBuffer.getMappedRange()
    );

    const materialGpuData = new Map<
      GLTFMaterialDescriptor,
      { bindGroup: GPUBindGroup }
    >();

    for (const texture of gltf.textures ?? []) {
      const sampler =
        createSampler(this.device, gltf.samplers[texture.sampler]) ??
        this.defaultSampler;
      const image = textures[texture.source];

      this.textures.push({
        texture: image,
        sampler,
      });
    }

    for (const material of gltf.materials ?? []) {
      this.setupMaterial(material, materialGpuData);
    }

    for (const mesh of gltf.meshes) {
      for (const primitive of mesh.primitives) {
        this.setupPrimitive(
          primitive,
          gltf,
          primitiveInstances,
          materialGpuData
        );
      }
    }

    instanceBuffer.unmap();

    this.instanceBindGroup = this.device.createBindGroup({
      label: `glTF Instance BindGroup`,
      layout: this.instanceBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: instanceBuffer },
        },
      ],
    });

    this.depthTexture = this.device.createTexture({
      label: "Color texture",
      size: {
        width: this.canvas.width,
        height: this.canvas.height,
      },
      format: "depth24plus",
      sampleCount: SAMPLE_COUNT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });
    this.depthTextureView = this.depthTexture.createView();

    this.colorTexture = this.device.createTexture({
      label: "Depth texture",
      size: { width: this.canvas.width, height: this.canvas.height },
      sampleCount: SAMPLE_COUNT,
      format: "bgra8unorm",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.colorTextureView = this.colorTexture.createView();
  }

  getPipelineForPrimitive(args: {
    buffers: GPUVertexBufferLayout[];
    doubleSided: boolean;
    alphaMode: TODO;
  }) {
    const key = JSON.stringify(args);
    let existingPipeline = this.pipelineGpuData.get(key);

    if (existingPipeline) {
      return existingPipeline;
    }

    let blend = undefined;
    if (args.alphaMode == "BLEND") {
      blend = {
        color: {
          srcFactor: "src-alpha" as GPUBlendFactor,
          dstFactor: "one-minus-src-alpha" as GPUBlendFactor,
        },
        alpha: {
          // This just prevents the canvas from having alpha "holes" in it.
          srcFactor: "one" as GPUBlendFactor,
          dstFactor: "one" as GPUBlendFactor,
        },
      };
    }

    const module = this.getShaderModule({
      // ?
    });

    const pipeline = this.device.createRenderPipeline({
      label: "glTF Pipeline",
      layout: this.pipelineLayout,
      vertex: {
        module,
        entryPoint: "vertexMain",
        buffers: args.buffers,
      },
      fragment: {
        module,
        entryPoint: "fragmentMain",
        targets: [
          {
            format: navigator.gpu.getPreferredCanvasFormat(),
            // blend,
          },
        ],
      },
      primitive: {
        frontFace: "cw",
        cullMode: args.doubleSided ? "none" : "front",
        topology: "triangle-list",
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth24plus",
      },
      multisample: {
        count: SAMPLE_COUNT,
      },
    });

    const gpuPipeline = {
      pipeline,
      primitives: [],
    };

    this.pipelineGpuData.set(key, gpuPipeline);

    return gpuPipeline;
  }

  getShaderModule(args: TODO) {
    const key = JSON.stringify(args);

    let existingModule = this.shaderModules.get(key);

    if (existingModule) {
      return existingModule;
    }

    const shaderModule = this.device.createShaderModule({
      code: wgsl/* wgsl */ `
        struct Camera {
          projection: mat4x4f,
          view: mat4x4f,
          position: vec3f,
          time: f32,
        };

        @group(0) @binding(0) var<uniform> camera: Camera;
        @group(1) @binding(0) var<storage> models: array<mat4x4f>;

        struct Material {
          baseColorFactor: vec4f,
          alphaCutoff: f32,
        };

        @group(2) @binding(0) var<uniform> material: Material;
        @group(2) @binding(1) var materialSampler: sampler;
        @group(2) @binding(2) var baseColorTexture: texture_2d<f32>;

        struct VertexInput {
          @location(${ShaderLocations.POSITION}) position: vec4f,
          @location(${ShaderLocations.NORMAL}) normal: vec3f,
          #if ${args.hasTexcoord}
            @location(${ShaderLocations.TEXCOORD_0}) uv: vec2f,
          #endif
        }

        struct VertexOutput {
          @builtin(position) position: vec4f,
          @location(0) normal: vec3f,
          @location(1) uv: vec2f,
        };

        @vertex
        fn vertexMain(input: VertexInput, @builtin(instance_index) instance: u32) -> VertexOutput {
          var output: VertexOutput;
          output.position = camera.projection * camera.view * models[instance] * input.position;
          output.normal = normalize((models[instance] * vec4f(input.normal, 0.0)).xyz);
          #if ${args.uv}
            output.uv = input.uv;
          #else
            output.uv = vec2f(0);
          #endif
          return output;
        }

        const lightDirection = vec3f(0.25, 0.5, 1);
        const lightColor = vec3f(1);
        const ambientColor = vec3f(0.3);

        @fragment
        fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
          let baseColor = textureSample(
            baseColorTexture,
            materialSampler,
            input.uv
          ) * material.baseColorFactor;

          #if ${args.useAlphaCutoff}
            // If the alpha mode is MASK discard any fragments below the alpha cutoff.
            if (baseColor.a < material.alphaCutoff) {
              discard;
            }
          #endif

          let n = normalize(input.normal);
          let l = normalize(lightDirection);
          let nDotL = max(dot(n, l), 0.0);

          var result = (baseColor.rgb * ambientColor) + (baseColor.rgb * nDotL);
          result = result / (result + vec3f(1.0));
          result = pow(result, vec3f(1.0 / 2.2));

          return vec4f(result, baseColor.a);
        }
      `,
    });

    this.shaderModules.set(key, shaderModule);
    return shaderModule;
  }

  setupMaterial(
    material: GLTFMaterialDescriptor,
    materialGpuData: Map<GLTFMaterialDescriptor, { bindGroup: GPUBindGroup }>
  ) {
    const valueCount = 5;
    const materialUniformBuffer = this.device.createBuffer({
      size: alignTo(valueCount, 4) * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.UNIFORM,
      mappedAtCreation: true,
    });
    const materialBufferArray = new Float32Array(
      materialUniformBuffer.getMappedRange()
    );

    materialBufferArray.set(
      material.pbrMetallicRoughness?.baseColorFactor || [1, 1, 1, 1]
    );
    materialBufferArray[4] = material.alphaCutoff || 0.5;
    materialUniformBuffer.unmap();

    // The baseColorTexture may not be specified either. If not use a plain white texture instead.
    const index = material.pbrMetallicRoughness?.baseColorTexture?.index;
    let baseColor = index
      ? {
          texture: this.textures[index].texture,
          sampler: this.textures[index].sampler,
        }
      : {
          texture: this.opaqueWhiteTexture,
          sampler: this.defaultSampler,
        };

    const bindGroup = this.device.createBindGroup({
      label: `glTF Material BindGroup`,
      layout: this.materialBindGroupLayout,
      entries: [
        {
          binding: 0, // Material uniforms
          resource: { buffer: materialUniformBuffer },
        },
        {
          binding: 1, // Sampler
          resource: baseColor.sampler,
        },
        {
          binding: 2, // BaseColor
          resource: baseColor.texture.createView(),
        },
      ],
    });

    // Associate the bind group with this material.
    materialGpuData.set(material, {
      bindGroup,
    });
  }

  setupPrimitiveInstances(
    primitive: GLTFPrimitiveDescriptor,
    primitiveInstances: PrimitiveInstances
  ) {
    const instances = primitiveInstances.matrices.get(primitive);
    invariant(instances, "Primitive instances not found.");

    const first = primitiveInstances.offset;
    const count = instances.length;

    invariant(primitiveInstances.arrayBuffer, "Array buffer not found.");
    for (let i = 0; i < count; i++) {
      primitiveInstances.arrayBuffer.set(instances[i].data, (first + i) * 16);
    }

    primitiveInstances.offset += count;

    return { first, count };
  }

  setupPrimitive(
    primitive: GLTFPrimitiveDescriptor,
    gltf: GLTFDescriptor,
    primitiveInstances: PrimitiveInstances,
    materialGpuData: Map<GLTFMaterialDescriptor, { bindGroup: GPUBindGroup }>
  ) {
    const bufferLayout = new Map<string | number, GPUVertexBufferLayout>();
    const gpuBuffers = new Map<
      GPUVertexBufferLayout,
      { buffer: GPUBuffer; offset: number }
    >();
    for (const [attributeName, accessorIndex] of Object.entries(
      primitive.attributes
    )) {
      const accessor = gltf.accessors[accessorIndex];
      const bufferView = gltf.bufferViews[accessor.bufferView];

      const shaderLocation = ShaderLocations[attributeName];

      if (shaderLocation === undefined) {
        console.warn(`Unknown shader location ${attributeName}`);
        continue;
      }

      const offset = accessor.byteOffset ?? 0;

      let buffer = bufferLayout.get(accessor.bufferView);
      let gpuBuffer;
      let separate =
        buffer &&
        // @ts-expect-error ts(7053)
        Math.abs(offset - buffer.attributes[0].offset) >= buffer.arrayStride;

      if (!buffer || separate) {
        buffer = {
          arrayStride:
            bufferView.byteStride || packedArrayStrideForAccessor(accessor),
          attributes: [],
        };
        bufferLayout.set(
          separate ? attributeName : accessor.bufferView,
          buffer
        );

        const gpuBuffer = this.device.createBuffer({
          size: alignTo(bufferView.byteLength, 4),
          usage: GPUBufferUsage.VERTEX,
          mappedAtCreation: true,
        });
        new Uint8Array(gpuBuffer.getMappedRange()).set(
          gltf.buffers[0].subarray(
            bufferView.byteOffset,
            bufferView.byteOffset + bufferView.byteLength
          )
        );
        gpuBuffer.unmap();

        gpuBuffers.set(buffer, {
          buffer: gpuBuffer,
          offset,
        });
      } else {
        gpuBuffer = gpuBuffers.get(buffer);
        invariant(gpuBuffer, "Buffer not found.");
        // Track the minimum offset across all attributes that share a buffer.
        gpuBuffer.offset = Math.min(gpuBuffer.offset, offset);
      }

      // @ts-expect-error Property 'push' does not exist on type 'Iterable<GPUVertexAttribute>'.ts(2339)
      buffer.attributes.push({
        shaderLocation,
        format: gpuFormatForAccessor(accessor),
        offset,
      });
    }

    for (const buffer of bufferLayout.values()) {
      const gpuBuffer = gpuBuffers.get(buffer);
      invariant(gpuBuffer, "Buffer not found.");

      for (const attribute of buffer.attributes) {
        attribute.offset -= gpuBuffer.offset;
      }

      // @ts-expect-error Property 'sort' does not exist on type 'Iterable<GPUVertexAttribute>'.ts(2339)
      buffer.attributes = buffer.attributes.sort(
        (a: GPUVertexAttribute, b: GPUVertexAttribute) => {
          return a.shaderLocation - b.shaderLocation;
        }
      );
    }

    const sortedBufferLayout = [...bufferLayout.values()].sort(
      (a: GPUVertexBufferLayout, b: GPUVertexBufferLayout) => {
        // @ts-ignore Property '0' does not exist on type 'Iterable<GPUVertexAttribute>'.ts(7053)
        return a.attributes[0].shaderLocation - b.attributes[0].shaderLocation;
      }
    );

    const sortedGpuBuffers = [];
    for (const buffer of sortedBufferLayout) {
      const gpuBuffer = gpuBuffers.get(buffer);
      invariant(gpuBuffer, "Buffer not found.");
      sortedGpuBuffers.push(gpuBuffer);
    }

    const accessor = gltf.accessors[primitive.indices];
    const bufferView = gltf.bufferViews[accessor.bufferView];

    const view = gltf.buffers[0].subarray(
      bufferView.byteOffset,
      bufferView.byteOffset + bufferView.byteLength
    );

    const indexBuffer = this.device.createBuffer({
      size: alignTo(bufferView.byteLength, 4),
      usage: GPUBufferUsage.INDEX,
      mappedAtCreation: true,
    });
    new Uint8Array(indexBuffer.getMappedRange()).set(view);
    indexBuffer.unmap();

    invariant("indices" in primitive, "Primitive must have indices.");

    const material = gltf.materials[primitive.material];
    const gpuMaterial = materialGpuData.get(material);
    invariant(gpuMaterial, "Material not found.");

    const pipeline = this.getPipelineForPrimitive({
      buffers: sortedBufferLayout,
      doubleSided: false,
      alphaMode: "OPAQUE",
    });

    const gpuPrimitive = {
      pipeline: pipeline.pipeline,
      buffers: sortedGpuBuffers,
      instances: this.setupPrimitiveInstances(primitive, primitiveInstances),
      indexBuffer: indexBuffer,
      indexOffset: accessor.byteOffset ?? 0,
      indexType: gpuIndexFormatForComponentType(accessor.componentType),
      drawCount: accessor.count,
      material: gpuMaterial,
    };

    pipeline.primitives.push(gpuPrimitive);
  }

  getTRS(node: GLTFNodeDescriptor) {
    if (node.matrix) {
      return new Mat4(node.matrix);
    } else {
      const translation = node.translation
        ? Mat4.translate(
            node.translation[0],
            node.translation[1],
            node.translation[2]
          )
        : Mat4.identity();

      const rotation = node.rotation
        ? Mat4.rotateFromQuat(
            new Vec4(
              node.rotation[0],
              node.rotation[1],
              node.rotation[2],
              node.rotation[3]
            )
          )
        : Mat4.identity();

      const scale = node.scale
        ? Mat4.scale(node.scale[0], node.scale[1], node.scale[2])
        : Mat4.identity();

      return scale.multiply(rotation).multiply(translation);
    }
  }

  setupNode(node: GLTFNodeDescriptor, primitiveInstances: PrimitiveInstances) {
    let trs = this.nodeTransforms.get(node);
    invariant(trs, "Node transform not found.");

    const mesh = this.gltf.meshes[node.mesh];

    if (node.children) {
      for (const child of node.children) {
        this.nodeParents.set(this.gltf.nodes[child], node);
      }
    }

    let parent = this.nodeParents.get(node);
    while (parent) {
      const parentTransform = this.nodeTransforms.get(parent);
      invariant(parentTransform, "Parent transform not found.");

      trs = trs.multiply(parentTransform);
      parent = this.nodeParents.get(parent);
    }

    if (!mesh) {
      // TODO: why it doesn't exist?
      return;
    }

    for (const primitive of mesh.primitives) {
      let instances = primitiveInstances.matrices.get(primitive);
      if (instances === undefined) {
        instances = [];
        primitiveInstances.matrices.set(primitive, instances);
      }
      instances.push(trs);
    }

    // Make sure to add the number of matrices used for this mesh to the total.
    primitiveInstances.total += mesh.primitives.length;
  }

  render() {
    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.colorTextureView,
          resolveTarget: this.context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: this.depthTextureView,
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });

    const projection = Mat4.perspective(
      Math.PI / 2,
      this.canvas.width / this.canvas.height,
      0.1,
      1000
    );
    const view = this.camera.getView().invert();
    const cameraUniforms = new Float32Array([
      ...projection.data,
      ...view.data,
      ...this.camera.getPosition().data(),
      performance.now(),
    ]);

    this.device.queue.writeBuffer(this.cameraUniformBuffer, 0, cameraUniforms);

    passEncoder.setBindGroup(0, this.cameraBindGroup);
    passEncoder.setBindGroup(1, this.instanceBindGroup);

    for (const gpuPipeline of this.pipelineGpuData.values()) {
      passEncoder.setPipeline(gpuPipeline.pipeline);

      for (const gpuPrimitive of gpuPipeline.primitives) {
        for (const [bufferIndex, gpuBuffer] of Object.entries(
          gpuPrimitive.buffers
        )) {
          passEncoder.setVertexBuffer(
            Number(bufferIndex),
            gpuBuffer.buffer,
            gpuBuffer.offset
          );
        }
        passEncoder.setIndexBuffer(
          gpuPrimitive.indexBuffer,
          gpuPrimitive.indexType,
          gpuPrimitive.indexOffset
        );

        passEncoder.setBindGroup(2, gpuPrimitive.material.bindGroup);

        passEncoder.drawIndexed(
          gpuPrimitive.drawCount,
          gpuPrimitive.instances.count,
          0,
          0,
          gpuPrimitive.instances.first
        );
      }
    }
    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);

    requestAnimationFrame(this.render);
  }
}
