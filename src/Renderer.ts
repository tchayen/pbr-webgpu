import { invariant } from "./lib/invariant";
import { ObjData, parseObjFile } from "./lib/Obj";
import { Vec2 } from "./lib/math/Vec2";
import { Vec3 } from "./lib/math/Vec3";
import { Mat4 } from "./lib/math/Mat4";
import { toRadians } from "./lib/math/utils";
import { Camera } from "./lib/Camera";
import { renderToCubemap } from "./lib/convertEquirectangularToCubemap";
import { getIrradianceMap } from "./lib/getIrradianceMap";
import { getPrefilterMap } from "./lib/getPrefilterMap";
import { getBRDFConvolutionLUT } from "./lib/getBRDFconvolution";
import { cubeVertexArray } from "./lib/cubemapShared";
import {
  distributionGGX,
  fresnelSchlick,
  fresnelSchlickRoughness,
  geometrySchlickGGX,
  geometrySmith,
  toneMappings,
} from "./lib/pbrShaderFunctions";
import { createBuffer } from "./lib/createBuffer";

const LIGHT_COUNT = 4;
const COUNT_X = 6;
const COUNT_Y = 2;
const CUBEMAP_SIZE = 512;
const IRRADIANCE_MAP_SIZE = 32;
const PREFILTER_MAP_SIZE = 256;
const ROUGHNESS_LEVELS = 5;
const SAMPLE_COUNT = 4;

const lights = [
  {
    position: new Vec3(-10, 10, 10),
    color: new Vec3(100, 100, 100),
  },
  {
    position: new Vec3(10, 10, 10),
    color: new Vec3(100, 100, 100),
  },
  {
    position: new Vec3(-10, -10, 10),
    color: new Vec3(100, 100, 100),
  },
  {
    position: new Vec3(10, -10, 10),
    color: new Vec3(100, 100, 100),
  },
];

export class Renderer {
  state: "not-created" | "initializing" | "ready" | "destroyed" = "not-created";

  canvas!: HTMLCanvasElement;
  context!: GPUCanvasContext | null;
  device!: GPUDevice;

  cubemapTexture!: GPUTexture;
  irradianceMap!: GPUTexture;
  prefilterMap!: GPUTexture;
  brdfLookup!: GPUTexture;

  camera!: Camera;
  balls!: Vec2[];
  obj!: ObjData;

  pipeline!: GPURenderPipeline;
  positionBuffer!: GPUBuffer;
  uniformBuffer!: GPUBuffer;
  uniformBindGroup!: GPUBindGroup;
  textureBindGroup!: GPUBindGroup;
  matrixBuffer!: GPUBuffer;
  matrixBindGroup!: GPUBindGroup;
  lightsBuffer!: GPUBuffer;
  colorTextureView!: GPUTextureView;
  depthTextureView!: GPUTextureView;

  cubemapVerticesBuffer!: GPUBuffer;

  skyboxPipeline!: GPURenderPipeline;
  cubemapUniformBuffer!: GPUBuffer;
  viewProjectionBuffer!: GPUBuffer;
  cubemapUniformBindGroup!: GPUBindGroup;
  colorTexture!: GPUTexture;
  depthTexture!: GPUTexture;

  constructor() {
    this.init = this.init.bind(this);
    this.destroy = this.destroy.bind(this);
    this.render = this.render.bind(this);
  }

  async init(
    canvas: HTMLCanvasElement,
    environment: string,
    toneMapping: "reinhard" | "uncharted2" | "aces" | "lottes",
  ) {
    if (!["not-created", "destroyed"].includes(this.state)) {
      console.log("Already created. Skipping initialization.");
      return;
    }

    this.state = "initializing";

    this.canvas = canvas;
    this.canvas.width = this.canvas.clientWidth * window.devicePixelRatio;
    this.canvas.height = this.canvas.clientHeight * window.devicePixelRatio;

    let toneMappingFunction;

    switch (toneMapping) {
      case "reinhard":
        toneMappingFunction = toneMappings.reinhard;
        break;
      case "uncharted2":
        toneMappingFunction = toneMappings.uncharted2;
        break;
      case "aces":
        toneMappingFunction = toneMappings.aces;
        break;
      case "lottes":
        toneMappingFunction = toneMappings.lottes;
        break;
    }

    const sphere = await fetch("/assets/sphere.obj").then((response) =>
      response.text(),
    );

    this.obj = parseObjFile(sphere);

    this.context = this.canvas.getContext("webgpu");
    invariant(this.context, "WebGPU is not supported in this browser.");

    const entry = navigator.gpu;
    invariant(entry, "WebGPU is not supported in this browser.");

    const adapter = await entry.requestAdapter();
    invariant(adapter, "No GPU found on this system.");

    this.device = await adapter.requestDevice({
      label: "device" + Math.random(),
    });

    this.context.configure({
      device: this.device,
      format: navigator.gpu.getPreferredCanvasFormat(),
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
      alphaMode: "opaque",
    });

    // Convert OBJ to a buffer format.
    const buffer = [];
    for (const face of this.obj.faces) {
      for (const faceVertex of face.vertices) {
        const position = this.obj.vertices[faceVertex.vertexIndex];
        const normal = this.obj.normals[faceVertex.normalIndex];
        const uv = this.obj.uvs[faceVertex.uvIndex];

        buffer.push(
          position.x,
          position.y,
          position.z,
          normal.x,
          normal.y,
          normal.z,
          uv.x,
          uv.y,
        );
      }
    }

    this.cubemapVerticesBuffer = createBuffer(
      this.device,
      cubeVertexArray,
      GPUBufferUsage.VERTEX,
    );

    this.cubemapTexture = await renderToCubemap(
      this.device,
      environment,
      CUBEMAP_SIZE,
    );
    this.irradianceMap = getIrradianceMap(
      this.device,
      this.cubemapTexture,
      IRRADIANCE_MAP_SIZE,
    );
    this.prefilterMap = getPrefilterMap(
      this.device,
      this.cubemapTexture,
      PREFILTER_MAP_SIZE,
      ROUGHNESS_LEVELS,
    );
    this.brdfLookup = getBRDFConvolutionLUT(this.device, 512);

    this.positionBuffer = createBuffer(
      this.device,
      new Float32Array(buffer),
      GPUBufferUsage.VERTEX,
    );

    const pbrVertexShader = /* wgsl */ `
struct VSOut {
  @builtin(position) Position: vec4f,
  @location(0) normal: vec3f,
  @location(1) uv: vec2f,
  @location(2) @interpolate(flat) instanceIndex: u32,
  @location(3) worldPosition: vec3f,
};

@group(1) @binding(0) var<uniform> modelMatrices: array<mat4x4f, ${
      COUNT_X * COUNT_Y
    }>;
@group(1) @binding(1) var<uniform> viewProjectionMatrix: mat4x4f;

@vertex
fn main(
  @builtin(instance_index) instanceIndex: u32,
  @location(0) inPosition: vec3f,
  @location(1) inNormal: vec3f,
  @location(2) inUV: vec2f,
) -> VSOut {
    var vsOut: VSOut;
    vsOut.Position = viewProjectionMatrix * modelMatrices[instanceIndex] * vec4f(inPosition, 1);
    vsOut.normal = inNormal;
    vsOut.uv = inUV;
    vsOut.worldPosition = (modelMatrices[instanceIndex] * vec4f(inPosition, 1)).xyz;
    vsOut.instanceIndex = instanceIndex;
    return vsOut;
}
`;

    const fragShaderCode = /* wgsl */ `
struct Uniforms {
  cameraPosition: vec3f,
}

struct Light {
  position: vec3f,
  color: vec3f,
}

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var<uniform> lights: array<Light, ${LIGHT_COUNT}>;

@group(2) @binding(0) var ourSampler: sampler;
@group(2) @binding(1) var samplerBRDF: sampler;
@group(2) @binding(2) var brdfLUT: texture_2d<f32>;
@group(2) @binding(3) var irradianceMap: texture_cube<f32>;
@group(2) @binding(4) var prefilterMap: texture_cube<f32>;

const PI = 3.14159265359;

${distributionGGX}
${geometrySchlickGGX}
${geometrySmith}
${fresnelSchlick}
${fresnelSchlickRoughness}
${toneMappingFunction}

const MAX_REFLECTION_LOD = 4.0;

@fragment
fn main(
  @location(0) normal: vec3f,
  @location(1) uv: vec2f,
  @location(2) @interpolate(flat) instanceIndex: u32,
  @location(3) worldPosition: vec3f,
) -> @location(0) vec4f {
  let ao = 1.0;
  let albedo = select(vec3f(0.957, 0.792, 0.407), vec3f(1, 0, 0), instanceIndex < 6);
  let metallic = select(1.0, 0.0, instanceIndex < 6);
  let roughness = f32(instanceIndex) % 6 / 6;

  let n = normalize(normal);
  let v = normalize(uni.cameraPosition - worldPosition);
  let r = reflect(-v, n);

  let f0 = mix(vec3f(0.04), albedo, metallic);

  var lo = vec3f(0.0);

  for (var i = 0; i < ${LIGHT_COUNT}; i++) {
    let l = normalize(lights[i].position - worldPosition);
    let h = normalize(v + l);

    let distance = length(lights[i].position - worldPosition);
    let attenuation = 1.0 / (distance * distance);
    let radiance = lights[i].color * attenuation;

    let d = distributionGGX(n, h, roughness);
    let g = geometrySmith(n, v, l, roughness);
    let f = fresnelSchlick(max(dot(h, v), 0.0), f0);

    let numerator = d * g * f;
    let denominator = 4.0 * max(dot(n, v), 0.0) * max(dot(n, l), 0.0) + 0.00001;
    let specular = numerator / denominator;

    let kS = f;
    var kD = vec3f(1.0) - kS;
    kD *= 1.0 - metallic;

    let nDotL = max(dot(n, l), 0.00001);
    lo += (kD * albedo / PI + specular) * radiance * nDotL;
  }

  let f = fresnelSchlickRoughness(max(dot(n, v), 0.00001), f0, roughness);
  let kS = f;
  var kD = vec3f(1.0) - kS;
  kD *= 1.0 - metallic;

  let irradiance = textureSample(irradianceMap, ourSampler, n).rgb;
  let diffuse = irradiance * albedo;

  let prefilteredColor = textureSampleLevel(prefilterMap, ourSampler, r, roughness * MAX_REFLECTION_LOD).rgb;
  let brdf = textureSample(brdfLUT, samplerBRDF, vec2f(max(dot(n, v), 0.0), roughness)).rg;
  let specular = prefilteredColor * (f * brdf.x + brdf.y);

  let ambient = (kD * diffuse + specular) * ao;

  var color = ambient + lo;
  color = toneMapping(color);
  color = pow(color, vec3f(1.0 / 2.2));
  return vec4f(color, 1.0);
}
`;

    const vertexModule = this.device.createShaderModule({
      code: pbrVertexShader,
    });
    const fragmentModule = this.device.createShaderModule({
      code: fragShaderCode,
    });

    const sampler = this.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
      addressModeU: "repeat",
      addressModeV: "repeat",
    });

    const samplerBRDF = this.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
    });

    this.pipeline = this.device.createRenderPipeline({
      label: "specular IBL example",
      vertex: {
        module: vertexModule,
        entryPoint: "main",
        buffers: [
          {
            attributes: [
              // Position
              {
                shaderLocation: 0,
                offset: 0,
                format: "float32x3",
              },
              // Normal
              {
                shaderLocation: 1,
                offset: 12,
                format: "float32x3",
              },
              // UV
              {
                shaderLocation: 2,
                offset: 24,
                format: "float32x2",
              },
            ],
            arrayStride: (3 + 3 + 2) * Float32Array.BYTES_PER_ELEMENT,
            stepMode: "vertex",
          },
        ],
      },
      fragment: {
        module: fragmentModule,
        entryPoint: "main",
        targets: [{ format: "bgra8unorm" }],
      },
      layout: "auto",
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

    const skyboxVertexShader = /* wgsl */ `
  struct Uniforms {
    view: mat4x4f,
    projection: mat4x4f,
  }
  @binding(0) @group(0) var<uniform> uniforms: Uniforms;

  struct VertexOutput {
    @builtin(position) Position: vec4f,
    @location(0) fragmentPosition: vec4f,
  }

  @vertex
  fn main(@location(0) position: vec4f) -> VertexOutput {
    var output: VertexOutput;

    var copy = uniforms.view;
    // Reset
    copy[3][0] = 0.0;
    copy[3][1] = 0.0;
    copy[3][2] = 0.0;

    output.Position = (uniforms.projection * copy * position).xyww;
    output.fragmentPosition = 0.5 * (position + vec4(1.0, 1.0, 1.0, 1.0));
    return output;
  }
`;

    const skyboxFragmentShader = /* wgsl */ `
  @group(0) @binding(1) var mySampler: sampler;
  @group(0) @binding(2) var myTexture: texture_cube<f32>;

  ${toneMappingFunction}

  @fragment
  fn main(@location(0) fragmentPosition: vec4f) -> @location(0) vec4f {
    var cubemapVec = fragmentPosition.xyz - vec3(0.5);
    var color = textureSample(myTexture, mySampler, cubemapVec).rgb;
    color = toneMapping(color);
    color = pow(color, vec3f(1.0 / 2.2));
    return vec4f(color, 1);
  }
    `;

    this.skyboxPipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: this.device.createShaderModule({ code: skyboxVertexShader }),
        entryPoint: "main",
        buffers: [
          {
            arrayStride: 4 * Float32Array.BYTES_PER_ELEMENT,
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
        module: this.device.createShaderModule({ code: skyboxFragmentShader }),
        entryPoint: "main",
        targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }],
      },
      primitive: {
        topology: "triangle-list",
        frontFace: "cw",
        cullMode: "none",
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less-equal",
        format: "depth24plus",
      },
      multisample: {
        count: SAMPLE_COUNT,
      },
    });

    this.uniformBuffer = this.device.createBuffer({
      size: Float32Array.BYTES_PER_ELEMENT * 4 * 1,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.lightsBuffer = this.device.createBuffer({
      label: "lights",
      size: Float32Array.BYTES_PER_ELEMENT * 4 * 2 * LIGHT_COUNT,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.uniformBindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this.uniformBuffer },
        },
        {
          binding: 1,
          resource: { buffer: this.lightsBuffer },
        },
      ],
    });

    this.cubemapUniformBuffer = this.device.createBuffer({
      size: Float32Array.BYTES_PER_ELEMENT * 16 * 2,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.cubemapUniformBindGroup = this.device.createBindGroup({
      layout: this.skyboxPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.cubemapUniformBuffer,
            offset: 0,
            size: Float32Array.BYTES_PER_ELEMENT * 16 * 2,
          },
        },
        {
          binding: 1,
          resource: sampler,
        },
        {
          binding: 2,
          resource: this.irradianceMap.createView({ dimension: "cube" }),
        },
      ],
    });

    const distance = 2.8;

    this.balls = [];
    for (let y = 0; y < COUNT_Y; y++) {
      for (let x = 0; x < COUNT_X; x++) {
        this.balls.push(
          new Vec2(
            x * distance - (distance * (COUNT_X - 1)) / 2,
            y * distance - distance / 2,
          ),
        );
      }
    }

    this.matrixBuffer = this.device.createBuffer({
      size: 16 * Float32Array.BYTES_PER_ELEMENT * COUNT_X * COUNT_Y,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.viewProjectionBuffer = this.device.createBuffer({
      size: 16 * Float32Array.BYTES_PER_ELEMENT * 2,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.matrixBindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(1),
      entries: [
        { binding: 0, resource: { buffer: this.matrixBuffer } },
        { binding: 1, resource: { buffer: this.viewProjectionBuffer } },
      ],
    });

    this.textureBindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(2),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: samplerBRDF },
        { binding: 2, resource: this.brdfLookup.createView() },
        {
          binding: 3,
          resource: this.irradianceMap.createView({ dimension: "cube" }),
        },
        {
          binding: 4,
          resource: this.prefilterMap.createView({ dimension: "cube" }),
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

    this.camera = new Camera(toRadians(0), toRadians(90), this.canvas, 20);

    this.colorTexture = this.device.createTexture({
      label: "Depth texture",
      size: { width: this.canvas.width, height: this.canvas.height },
      sampleCount: SAMPLE_COUNT,
      format: "bgra8unorm",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.colorTextureView = this.colorTexture.createView();

    this.state = "ready";
    console.log("Initialized.");
  }

  destroy() {
    if (this.state !== "ready" || !this.device) {
      return;
    }

    console.log("Destroying.");
    this.device.destroy();
    this.state = "destroyed";
  }

  render() {
    if (this.state !== "ready") {
      console.log("Cannot render, not initialized or destroyed.");
      return;
    }

    invariant(this.context, "Canvas context is not defined.");

    // Respond to potential resize events.
    if (
      this.canvas.clientWidth * window.devicePixelRatio !== this.canvas.width ||
      this.canvas.clientHeight * window.devicePixelRatio !== this.canvas.height
    ) {
      console.log(
        `Resizing canvas ${this.canvas.clientWidth * window.devicePixelRatio}x${
          this.canvas.clientHeight * window.devicePixelRatio
        }`,
      );
      this.canvas.width = this.canvas.clientWidth * window.devicePixelRatio;
      this.canvas.height = this.canvas.clientHeight * window.devicePixelRatio;

      this.colorTexture.destroy();
      this.depthTexture.destroy();

      this.colorTexture = this.device.createTexture({
        label: "Color texture",
        size: { width: this.canvas.width, height: this.canvas.height },
        sampleCount: SAMPLE_COUNT,
        format: "bgra8unorm",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      this.colorTextureView = this.colorTexture.createView();

      this.depthTexture = this.device.createTexture({
        label: "Depth texture",
        size: {
          width: this.canvas.width,
          height: this.canvas.height,
        },
        format: "depth24plus",
        sampleCount: SAMPLE_COUNT,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
      });
      this.depthTextureView = this.depthTexture.createView();
    }

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
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, this.uniformBindGroup);
    passEncoder.setBindGroup(1, this.matrixBindGroup);
    passEncoder.setBindGroup(2, this.textureBindGroup);
    passEncoder.setViewport(0, 0, this.canvas.width, this.canvas.height, 0, 1);
    passEncoder.setScissorRect(0, 0, this.canvas.width, this.canvas.height);
    passEncoder.setVertexBuffer(0, this.positionBuffer);
    passEncoder.draw(this.obj.faces.length * 3, COUNT_X * COUNT_Y, 0, 0);

    const view = this.camera.getView().invert();
    const projection = Mat4.perspective(
      toRadians(45),
      this.canvas.width / this.canvas.height,
      0.1,
      100,
    );

    const cameraPosition = this.camera.getPosition();

    const bufferContent = new Float32Array([...vec3ToArray(cameraPosition)]);
    const matrixContent = new Float32Array(
      this.balls
        .map((ball) => {
          return Mat4.translate(ball.x, ball.y, 0);
        })
        .map((matrix) => matrix.data)
        .flat(),
    );
    const viewProjectionContent = new Float32Array([
      ...view.multiply(projection).data,
    ]);

    this.device.queue.writeBuffer(this.uniformBuffer, 0, bufferContent.buffer);
    this.device.queue.writeBuffer(
      this.lightsBuffer,
      0,
      new Float32Array(
        lights
          .slice(0, LIGHT_COUNT)
          .map((light) => [
            ...vec3ToArray(light.position),
            ...vec3ToArray(light.color),
          ])
          .flat(),
      ).buffer,
    );
    this.device.queue.writeBuffer(this.matrixBuffer, 0, matrixContent.buffer);
    this.device.queue.writeBuffer(
      this.viewProjectionBuffer,
      0,
      viewProjectionContent.buffer,
    );

    // Render skybox
    this.device.queue.writeBuffer(
      this.cubemapUniformBuffer,
      0,
      new Float32Array([...view.data, ...projection.data].flat()).buffer,
    );

    passEncoder.setPipeline(this.skyboxPipeline);
    passEncoder.setVertexBuffer(0, this.cubemapVerticesBuffer);
    passEncoder.setBindGroup(0, this.cubemapUniformBindGroup);
    passEncoder.draw(36);
    passEncoder.end();

    this.device.queue.submit([commandEncoder.finish()]);

    requestAnimationFrame(this.render);
  }
}

function vec3ToArray(vec: Vec3) {
  return [vec.x, vec.y, vec.z, 0];
}
