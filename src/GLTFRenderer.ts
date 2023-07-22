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
} from "./lib/gltfUtils";

const ShaderLocations: Record<string, number> = {
  POSITION: 0,
  NORMAL: 1,
};

const SAMPLE_COUNT = 4;

type TODO = any;

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
  materialGpuData = new Map<GLTFMaterialDescriptor, GPUBindGroup>();
  nodeGpuData = new Map<GLTFNodeDescriptor, NodeGpuData>();

  cameraBindGroupLayout: GPUBindGroupLayout;
  instanceBindGroupLayout: GPUBindGroupLayout;
  pipelineLayout: GPUPipelineLayout;
  cameraUniformBuffer: GPUBuffer;
  cameraBindGroup: GPUBindGroup;

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

  constructor(
    private device: GPUDevice,
    private gltf: GLTFDescriptor,
    private canvas: HTMLCanvasElement,
    private context: GPUCanvasContext
  ) {
    this.render = this.render.bind(this);

    this.camera = new Camera(0, 0);

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

    this.pipelineLayout = this.device.createPipelineLayout({
      label: "glTF Pipeline Layout",
      bindGroupLayouts: [
        this.cameraBindGroupLayout,
        this.instanceBindGroupLayout,
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

    for (const mesh of gltf.meshes) {
      for (const primitive of mesh.primitives) {
        this.setupPrimitive(primitive, gltf, primitiveInstances);
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

    const module = this.getShaderModule();
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
        cullMode: args.doubleSided ? "none" : "back",
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

  getShaderModule() {
    return this.device.createShaderModule({
      code: /* wgsl */ `
        struct Camera {
          projection: mat4x4f,
          view: mat4x4f,
          position: vec3f,
          time: f32,
        };

        @group(0) @binding(0) var<uniform> camera: Camera;
        @group(1) @binding(0) var<storage> models: array<mat4x4f>;

        struct VertexInput {
          @location(0) position: vec4f,
          @location(1) normal: vec3f,
        }

        struct VertexOutput {
          @builtin(position) position: vec4f,
          @location(0) normal: vec3f,
        };

        @vertex
        fn vertexMain(input: VertexInput, @builtin(instance_index) instance: u32) -> VertexOutput {
          var output: VertexOutput;
          output.position = camera.projection * camera.view * models[instance] * input.position;
          output.normal = normalize((models[instance] * vec4f(input.normal, 0.0)).xyz);
          return output;
        }

        const lightDirection = vec3f(0.25, 0.5, 1);
        const lightColor = vec3f(1);
        const materialColor = vec3f(0.8);

        @fragment
        fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
          let n = normalize(input.normal);
          let l = normalize(lightDirection);
          let nDotL = max(dot(n, l), 0.0);

          var result = materialColor * nDotL + vec3f(0.1);
          result = result / (result + vec3f(1.0));
          result = pow(result, vec3f(1.0 / 2.2));

          return vec4f(result, 1.0);
        }
      `,
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
    primitiveInstances: PrimitiveInstances
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
