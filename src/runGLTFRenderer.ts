import {
  ComponentType,
  GLTFAccessorDescriptor,
  GLTFDescriptor,
  GLTFNodeDescriptor,
  GLTFPrimitiveDescriptor,
  readGlb,
} from "./lib/readGlb";
import { invariant } from "./lib/invariant";
import { alignTo } from "./alignTo";
import { Mat4 } from "./lib/math/Mat4";
import { Camera } from "./lib/Camera";
import { Vec4 } from "./lib/math/Vec4";

export async function setupRendering() {
  const glb = await fetch("/assets/scene.glb").then((response) =>
    response.arrayBuffer()
  );

  const gltf = readGlb(glb);
  console.log(gltf);

  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 600;
  document.body.appendChild(canvas);

  const context = canvas.getContext("webgpu");
  invariant(context, "WebGPU is not supported in this browser.");

  const entry = navigator.gpu;
  invariant(entry, "WebGPU is not supported in this browser.");

  const adapter = await entry.requestAdapter();
  invariant(adapter, "No GPU found on this system.");

  const device = await adapter.requestDevice();

  context.configure({
    device,
    format: navigator.gpu.getPreferredCanvasFormat(),
    alphaMode: "opaque",
  });

  const renderer = new GLTFRenderer2(device, gltf, canvas, context);

  renderer.render();
}

const ShaderLocations: Record<string, number> = {
  POSITION: 0,
  NORMAL: 1,
};

const SAMPLE_COUNT = 4;

type GpuPrimitive = {
  pipeline: GPURenderPipeline;
  buffers: GPUBuffer[];
  indexBuffer: GPUBuffer;
  indexOffset: number;
  indexType: GPUIndexFormat;
  drawCount: number;
};

type NodeGpuData = {
  bindGroup: GPUBindGroup;
};

class GLTFRenderer2 {
  primitiveGpuData = new Map<GLTFPrimitiveDescriptor, GpuPrimitive>();
  nodeGpuData = new Map<GLTFNodeDescriptor, NodeGpuData>();

  cameraBindGroupLayout: GPUBindGroupLayout;
  nodeBindGroupLayout: GPUBindGroupLayout;
  pipelineLayout: GPUPipelineLayout;
  cameraUniformBuffer: GPUBuffer;
  cameraBindGroup: GPUBindGroup;

  camera: Camera;
  depthTexture: GPUTexture;
  depthTextureView: GPUTextureView;
  colorTexture: GPUTexture;
  colorTextureView: GPUTextureView;

  constructor(
    private device: GPUDevice,
    private gltf: GLTFDescriptor,
    private canvas: HTMLCanvasElement,
    private context: GPUCanvasContext
  ) {
    this.render = this.render.bind(this);

    this.camera = new Camera(0, 0);

    this.nodeBindGroupLayout = this.device.createBindGroupLayout({
      label: `glTF Node BindGroupLayout`,
      entries: [
        {
          binding: 0, // Node uniforms
          visibility: GPUShaderStage.VERTEX,
          buffer: {},
        },
      ],
    });

    this.cameraBindGroupLayout = this.device.createBindGroupLayout({
      label: `Frame BindGroupLayout`,
      entries: [
        {
          binding: 0, // Camera uniforms
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {},
        },
      ],
    });

    this.pipelineLayout = this.device.createPipelineLayout({
      label: "glTF Pipeline Layout",
      bindGroupLayouts: [this.cameraBindGroupLayout, this.nodeBindGroupLayout],
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
          binding: 0, // Camera uniforms
          resource: { buffer: this.cameraUniformBuffer },
        },
      ],
    });

    for (const node of gltf.nodes) {
      this.setupNode(node);
    }

    for (const mesh of gltf.meshes) {
      for (const primitive of mesh.primitives) {
        this.setupPrimitive(primitive, gltf);
      }
    }

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

  setupPrimitive(primitive: GLTFPrimitiveDescriptor, gltf: GLTFDescriptor) {
    const bufferLayout = [];
    const gpuBuffers = [];

    for (const [attributeName, accessorIndex] of Object.entries(
      primitive.attributes
    )) {
      const accessor = gltf.accessors[accessorIndex];
      const bufferView = gltf.bufferViews[accessor.bufferView];
      const shaderLocation = ShaderLocations[attributeName];
      // invariant(
      //   shaderLocation !== undefined,
      //   `Unknown shader location ${attributeName}`
      // );
      if (shaderLocation === undefined) {
        console.warn(`Unknown shader location ${attributeName}`);
        continue;
      }

      bufferLayout.push({
        arrayStride:
          bufferView.byteStride ?? packedArrayStrideForAccessor(accessor),
        attributes: [
          {
            shaderLocation,
            format: gpuFormatForAccessor(accessor),
            offset: accessor.byteOffset ?? 0,
          },
        ],
      });

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

      gpuBuffers.push(gpuBuffer);
    }

    const module = this.device.createShaderModule({
      code: /* wgsl */ `
        struct Camera {
          projection: mat4x4f,
          view: mat4x4f,
          position: vec3f,
          time: f32,
        };

        @group(0) @binding(0) var<uniform> camera: Camera;
        @group(1) @binding(0) var<uniform> model: mat4x4f;

        struct VertexInput {
          @location(0) position: vec4f,
          @location(1) normal: vec3f,
        }

        struct VertexOutput {
          @builtin(position) position: vec4f,
          @location(0) normal: vec3f,
        };

        @vertex
        fn vertexMain(input: VertexInput) -> VertexOutput {
          var output: VertexOutput;
          output.position = camera.projection * camera.view * model * input.position;
          output.normal = normalize((model * vec4f(input.normal, 0.0)).xyz);
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

    const pipeline = this.device.createRenderPipeline({
      label: "glTF Pipeline",
      layout: this.pipelineLayout,
      vertex: {
        module,
        entryPoint: "vertexMain",
        buffers: bufferLayout,
      },
      fragment: {
        module,
        entryPoint: "fragmentMain",
        targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }],
      },
      primitive: {
        frontFace: "cw",
        cullMode: "none",
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

    if (!("indices" in primitive)) {
      throw new Error("Primitive must have indices");
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

    this.primitiveGpuData.set(primitive, {
      pipeline,
      buffers: gpuBuffers,
      indexBuffer: indexBuffer,
      indexOffset: accessor.byteOffset ?? 0,
      indexType: gpuIndexFormatForComponentType(accessor.componentType),
      drawCount: accessor.count,
    });
  }

  setupNode(node: GLTFNodeDescriptor) {
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

    const rts = translation.multiply(rotation).multiply(scale);

    const nodeUniformBuffer = this.device.createBuffer({
      label: node.name,
      size: 16 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.device.queue.writeBuffer(
      nodeUniformBuffer,
      0,
      new Float32Array(rts.data)
    );

    const bindGroup = this.device.createBindGroup({
      label: node.name,
      layout: this.nodeBindGroupLayout,
      entries: [
        {
          binding: 0, // Node uniforms
          resource: { buffer: nodeUniformBuffer },
        },
      ],
    });

    this.nodeGpuData.set(node, { bindGroup });
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
    for (const [node, gpuNode] of this.nodeGpuData) {
      passEncoder.setBindGroup(1, gpuNode.bindGroup);

      const mesh = this.gltf.meshes[node.mesh];
      for (const primitive of mesh.primitives) {
        const gpuPrimitive = this.primitiveGpuData.get(primitive);
        invariant(gpuPrimitive, "Primitive not found.");
        passEncoder.setPipeline(gpuPrimitive.pipeline);

        for (const [bufferIndex, gpuBuffer] of Object.entries(
          gpuPrimitive.buffers
        )) {
          passEncoder.setVertexBuffer(Number(bufferIndex), gpuBuffer);
        }

        passEncoder.setIndexBuffer(
          gpuPrimitive.indexBuffer,
          gpuPrimitive.indexType,
          gpuPrimitive.indexOffset
        );
        passEncoder.drawIndexed(gpuPrimitive.drawCount);
      }
    }

    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);

    requestAnimationFrame(this.render);
  }
}

function numerOfComponentsForType(type: string) {
  switch (type) {
    case "SCALAR":
      return 1;
    case "VEC2":
      return 2;
    case "VEC3":
      return 3;
    case "VEC4":
      return 4;
    default:
      throw new Error(`Unknown type ${type}`);
  }
}

function gpuFormatForAccessor(
  accessor: GLTFAccessorDescriptor
): GPUVertexFormat {
  const normalized = accessor.normalized ? "norm" : "int";
  const count = numerOfComponentsForType(accessor.type);
  const multiplier = count > 1 ? `x${count}` : "";

  switch (accessor.componentType) {
    case ComponentType.BYTE:
      return `s${normalized}8${multiplier}` as GPUVertexFormat;
    case ComponentType.UNSIGNED_BYTE:
      return `u${normalized}8${multiplier}` as GPUVertexFormat;
    case ComponentType.SHORT:
      return `s${normalized}16${multiplier}` as GPUVertexFormat;
    case ComponentType.UNSIGNED_SHORT:
      return `u${normalized}16${multiplier}` as GPUVertexFormat;
    case ComponentType.UNSIGNED_INT:
      return `u${normalized}32${multiplier}` as GPUVertexFormat;
    case ComponentType.FLOAT:
      return `float32${multiplier}` as GPUVertexFormat;
    default:
      throw new Error(`Unknown component type ${accessor.componentType}`);
  }
}

function gpuIndexFormatForComponentType(
  componentType: ComponentType
): GPUIndexFormat {
  switch (componentType) {
    case ComponentType.UNSIGNED_SHORT:
      return "uint16";
    case ComponentType.UNSIGNED_INT:
      return "uint32";
    default:
      throw new Error(`Unknown component type ${componentType}`);
  }
}

function componentTypeSizeInBytes(componentType: ComponentType) {
  switch (componentType) {
    case ComponentType.BYTE:
    case ComponentType.UNSIGNED_BYTE:
      return 1;
    case ComponentType.SHORT:
    case ComponentType.UNSIGNED_SHORT:
      return 2;
    case ComponentType.UNSIGNED_INT:
    case ComponentType.FLOAT:
      return 4;
    default:
      throw new Error(`Unknown component type ${componentType}`);
  }
}

function packedArrayStrideForAccessor(accessor: GLTFAccessorDescriptor) {
  return (
    numerOfComponentsForType(accessor.type) *
    componentTypeSizeInBytes(accessor.componentType)
  );
}
