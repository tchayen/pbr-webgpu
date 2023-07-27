import { invariant } from "./lib/invariant";
import {
  GLTFDescriptor,
  GLTFMaterialDescriptor,
  GLTFMeshDescriptor,
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
  createRoughnessMetallicTexture,
} from "./lib/gltfUtils";
import { wgsl } from "./lib/wgslPreprocessor";
import {
  distributionGGX,
  fresnelSchlick,
  fresnelSchlickRoughness,
  geometrySchlickGGX,
  geometrySmith,
  toneMappings,
} from "./lib/pbrShaderFunctions";
import { logTime } from "./log";
import { hash } from "./lib/hash";

const ShaderLocations: Record<string, number> = {
  POSITION: 0,
  NORMAL: 1,
  TEXCOORD_0: 2,
  TANGENT: 3,
};

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

export class GltfPbrRenderer {
  pipelineGpuData = new Map<
    string,
    {
      pipeline: GPURenderPipeline;
      materialPrimitives: Map<Material, GpuPrimitive[]>;
    }
  >();

  primitiveGpuData = new Map<GLTFPrimitiveDescriptor, GpuPrimitive>();
  nodeGpuData = new Map<GLTFNodeDescriptor, NodeGpuData>();
  textures: { texture: GPUTexture; sampler: GPUSampler }[] = [];

  pipelineLayout: GPUPipelineLayout;

  bindGroupLayouts: {
    camera: GPUBindGroupLayout;
    instance: GPUBindGroupLayout;
    material: GPUBindGroupLayout;
    pbr: GPUBindGroupLayout;
  };

  cameraUniformBuffer: GPUBuffer;

  bindGroups: {
    camera: GPUBindGroup;
    instance: GPUBindGroup;
    pbr: GPUBindGroup;
  };

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

  // Mapping `${roughness}${metallic}` to texture.
  roughnessMetallicTextures = new Map<string, GPUTexture>();

  defaultSampler: GPUSampler;
  samplerBRDF: GPUSampler;
  opaqueWhiteTexture: GPUTexture;
  transparentBlackTexture: GPUTexture;
  defaultNormalTexture: GPUTexture;

  ibl: {
    irradianceMap: GPUTexture;
    prefilterMap: GPUTexture;
    brdfLookup: GPUTexture;
  };

  constructor(
    private device: GPUDevice,
    private gltf: GLTFDescriptor,
    private canvas: HTMLCanvasElement,
    private context: GPUCanvasContext,
    textures: GPUTexture[],
    irradianceMap: GPUTexture,
    prefilterMap: GPUTexture,
    brdfLookup: GPUTexture,
    private sampleCount: number,
  ) {
    this.render = this.render.bind(this);

    this.ibl = {
      irradianceMap,
      prefilterMap,
      brdfLookup,
    };

    this.camera = new Camera(0.5, 1.6);

    this.opaqueWhiteTexture = createSolidColorTexture(this.device, 1, 1, 1, 1);
    this.transparentBlackTexture = createSolidColorTexture(
      this.device,
      0,
      0,
      0,
      0,
    );
    this.defaultNormalTexture = createSolidColorTexture(
      this.device,
      0.5,
      0.5,
      1,
      1,
    );
    this.defaultSampler = createDefaultSampler(this.device);

    this.bindGroupLayouts = {
      instance: this.device.createBindGroupLayout({
        label: "instance",
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
            buffer: { type: "read-only-storage" },
          },
        ],
      }),
      camera: this.device.createBindGroupLayout({
        label: "camera",
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: {},
          },
        ],
      }),
      material: this.device.createBindGroupLayout({
        label: "material",
        entries: [
          // Material uniforms
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            buffer: {},
          },
          // Albedo
          {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {},
          },
          {
            binding: 2,
            visibility: GPUShaderStage.FRAGMENT,
            texture: {},
          },
          // Normal
          {
            binding: 3,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {},
          },
          {
            binding: 4,
            visibility: GPUShaderStage.FRAGMENT,
            texture: {},
          },
          // RoughnessMetallic
          {
            binding: 5,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {},
          },
          {
            binding: 6,
            visibility: GPUShaderStage.FRAGMENT,
            texture: {},
          },
          // AO
          {
            binding: 7,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {},
          },
          {
            binding: 8,
            visibility: GPUShaderStage.FRAGMENT,
            texture: {},
          },
          // Emissive
          {
            binding: 9,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {},
          },
          {
            binding: 10,
            visibility: GPUShaderStage.FRAGMENT,
            texture: {},
          },
        ],
      }),
      pbr: this.device.createBindGroupLayout({
        label: "PBR textures",
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {},
          },
          {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {},
          },
          {
            binding: 2,
            visibility: GPUShaderStage.FRAGMENT,
            texture: {},
          },
          {
            binding: 3,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { viewDimension: "cube" },
          },
          {
            binding: 4,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { viewDimension: "cube" },
          },
        ],
      }),
    };

    this.pipelineLayout = this.device.createPipelineLayout({
      label: "glTF scene",
      bindGroupLayouts: [
        this.bindGroupLayouts.camera,
        this.bindGroupLayouts.instance,
        this.bindGroupLayouts.material,
        this.bindGroupLayouts.pbr,
      ],
    });

    this.cameraUniformBuffer = this.device.createBuffer({
      label: "camera uniform",
      size: Float32Array.BYTES_PER_ELEMENT * 36,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.samplerBRDF = device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
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
      label: "instance",
      size: 16 * Float32Array.BYTES_PER_ELEMENT * primitiveInstances.total,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });

    primitiveInstances.arrayBuffer = new Float32Array(
      instanceBuffer.getMappedRange(),
    );

    const materialGpuData = new Map<
      GLTFMaterialDescriptor,
      { bindGroup: GPUBindGroup }
    >();

    for (const texture of gltf.textures ?? []) {
      const sampler =
        createSampler(this.device, (gltf.samplers ?? [])[texture.sampler]) ??
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
          mesh,
          primitive,
          gltf,
          primitiveInstances,
          materialGpuData,
        );
      }
    }

    instanceBuffer.unmap();

    this.bindGroups = {
      camera: this.device.createBindGroup({
        label: "camera",
        layout: this.bindGroupLayouts.camera,
        entries: [
          {
            binding: 0,
            resource: { buffer: this.cameraUniformBuffer },
          },
        ],
      }),
      instance: this.device.createBindGroup({
        label: "instance",
        layout: this.bindGroupLayouts.instance,
        entries: [
          {
            binding: 0,
            resource: { buffer: instanceBuffer },
          },
        ],
      }),
      pbr: this.device.createBindGroup({
        label: "PBR textures",
        layout: this.bindGroupLayouts.pbr,
        entries: [
          {
            binding: 0,
            resource: this.samplerBRDF,
          },
          {
            binding: 1,
            resource: this.defaultSampler,
          },
          {
            binding: 2,
            resource: this.ibl.brdfLookup.createView({}),
          },
          {
            binding: 3,
            resource: this.ibl.irradianceMap.createView({ dimension: "cube" }),
          },
          {
            binding: 4,
            resource: this.ibl.prefilterMap.createView({ dimension: "cube" }),
          },
        ],
      }),
    };

    this.depthTexture = this.device.createTexture({
      label: "depth",
      size: {
        width: this.canvas.width,
        height: this.canvas.height,
      },
      format: "depth24plus",
      sampleCount: this.sampleCount,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.depthTextureView = this.depthTexture.createView({ label: "depth" });

    this.colorTexture = this.device.createTexture({
      label: "color texture",
      size: { width: this.canvas.width, height: this.canvas.height },
      sampleCount: this.sampleCount,
      format: "bgra8unorm",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });
    this.colorTextureView = this.colorTexture.createView({ label: "color" });

    logTime("Finished constructor.");
  }

  getPipelineForPrimitive(args: {
    buffers: GPUVertexBufferLayout[];
    doubleSided: boolean;
    alphaMode: "OPAQUE" | "MASK" | "BLEND";
    shaderParameters: {
      hasUVs: boolean;
      hasTangents: boolean;
      useAlphaCutoff: boolean;
    };
  }) {
    const key = hash(JSON.stringify(args));
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

    const module = this.getShaderModule(args.shaderParameters);

    const pipeline = this.device.createRenderPipeline({
      label: "glTF scene",
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
            blend,
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
        count: this.sampleCount,
      },
    });

    const gpuPipeline = {
      pipeline,
      materialPrimitives: new Map(),
    };

    this.pipelineGpuData.set(key, gpuPipeline);

    return gpuPipeline;
  }

  getShaderModule(args: {
    hasUVs: boolean;
    hasTangents: boolean;
    useAlphaCutoff: boolean;
  }) {
    const key = JSON.stringify(args);

    let existingModule = this.shaderModules.get(key);

    if (existingModule) {
      return existingModule;
    }

    const shaderModule = this.device.createShaderModule({
      label: "glTF scene",
      code: wgsl/* wgsl */ `
        struct Camera {
          projection: mat4x4f,
          view: mat4x4f,
          position: vec3f,
          time: f32,
        };

        struct Material {
          baseColorFactor: vec4f,
          alphaCutoff: f32,
        };

        @group(0) @binding(0) var<uniform> camera: Camera;
        @group(1) @binding(0) var<storage> models: array<mat4x4f>;

        // Material
        @group(2) @binding(0) var<uniform> material: Material;
        @group(2) @binding(1) var albedoSampler: sampler;
        @group(2) @binding(2) var albedoTexture: texture_2d<f32>;
        @group(2) @binding(3) var normalSampler: sampler;
        @group(2) @binding(4) var normalTexture: texture_2d<f32>;
        @group(2) @binding(5) var roughnessMetallicSampler: sampler;
        @group(2) @binding(6) var roughnessMetallicTexture: texture_2d<f32>;
        @group(2) @binding(7) var aoSampler: sampler;
        @group(2) @binding(8) var aoTexture: texture_2d<f32>;
        @group(2) @binding(9) var emissiveSampler: sampler;
        @group(2) @binding(10) var emissiveTexture: texture_2d<f32>;

        // PBR textures
        @group(3) @binding(0) var samplerBRDF: sampler;
        @group(3) @binding(1) var samplerGeneral: sampler;
        @group(3) @binding(2) var brdfLUT: texture_2d<f32>;
        @group(3) @binding(3) var irradianceMap: texture_cube<f32>;
        @group(3) @binding(4) var prefilterMap: texture_cube<f32>;

        struct VertexInput {
          @location(${ShaderLocations.POSITION}) position: vec4f,
          @location(${ShaderLocations.NORMAL}) normal: vec3f,
          #if ${args.hasUVs}
          @location(${ShaderLocations.TEXCOORD_0}) uv: vec2f,
          #endif
          #if ${args.hasTangents}
          @location(${ShaderLocations.TANGENT}) tangent: vec4f,
          #endif
        }

        struct VertexOutput {
          @builtin(position) position: vec4f,
          @location(0) normal: vec3f,
          @location(1) uv: vec2f,
          @location(2) worldPosition: vec3f,
          #if ${args.hasTangents}
          @location(3) tangent: vec4f,
          #endif
        };

        @vertex
        fn vertexMain(input: VertexInput, @builtin(instance_index) instance: u32) -> VertexOutput {
          var output: VertexOutput;
          output.position = camera.projection * camera.view * models[instance] * input.position;
          output.normal = normalize((models[instance] * vec4f(input.normal, 0.0)).xyz);
          #if ${args.hasUVs}
          output.uv = input.uv;
          #else
          output.uv = vec2f(0);
          #endif
          #if ${args.hasTangents}
          output.tangent = models[instance] * input.tangent;
          #endif
          return output;
        }

        struct Light {
          position: vec3f,
          color: vec3f,
        };

        const sun = Light(
          vec3f(0.25, 0.5, 1),
          vec3f(1),
        );

        const lights = array<Light, 1>(sun);

        ${distributionGGX}
        ${geometrySchlickGGX}
        ${geometrySmith}
        ${fresnelSchlick}
        ${fresnelSchlickRoughness}
        ${toneMappings.aces}

        const MAX_REFLECTION_LOD = 4.0;
        const PI = 3.14159265359;

        @fragment
        fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
          let baseColor = textureSample(albedoTexture, albedoSampler, input.uv) * material.baseColorFactor;

          #if ${args.useAlphaCutoff}
          // If the alpha mode is MASK discard any fragments below the alpha cutoff.
          if (baseColor.a < material.alphaCutoff) {
            discard;
          }
          #endif

          let ao = textureSample(aoTexture, aoSampler, input.uv).r;
          let albedo = baseColor.rgb;

          let roughnessMetallic = textureSample(
            roughnessMetallicTexture,
            roughnessMetallicSampler,
            input.uv
          );
          let metallic = roughnessMetallic.b;
          let roughness = roughnessMetallic.g;
          let emissive = textureSample(emissiveTexture, emissiveSampler, input.uv).rgb;

          var normal = textureSample(normalTexture, normalSampler, input.uv).rgb;
          normal = normalize(normal * 2.0 - 1.0);

          #if ${args.hasTangents}
          var n = normalize(input.normal);
          let t = normalize(input.tangent.xyz);
          let b = cross(n, t) * input.tangent.w;
          let tbn = mat3x3f(t, b, n);
          n = normalize(tbn * normal);
          #else
          let n = normalize(input.normal);
          #endif

          let v = normalize(camera.position - input.worldPosition);
          let r = reflect(-v, n);

          let f0 = mix(vec3f(0.04), albedo, metallic);

          var lo = vec3f(0.0);
          for (var i = 0; i < 1; i++) {
            let l = normalize(lights[i].position - input.worldPosition);
            let h = normalize(v + l);

            let distance = length(lights[i].position - input.worldPosition);
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

          let irradiance = textureSample(irradianceMap, samplerGeneral, n).rgb;
          let diffuse = irradiance * albedo;

          let prefilteredColor = textureSampleLevel(prefilterMap, samplerGeneral, r, roughness * MAX_REFLECTION_LOD).rgb;
          let brdf = textureSample(brdfLUT, samplerBRDF, vec2f(max(dot(n, v), 0.0), roughness)).rg;
          let specular = prefilteredColor * (f * brdf.x + brdf.y);

          let ambient = (kD * diffuse + specular) * ao;

          var color = ambient + lo + emissive;
          color = toneMapping(color);
          color = pow(color, vec3f(1.0 / 2.2));
          return vec4f(color, 1.0);
        }
      `,
    });

    this.shaderModules.set(key, shaderModule);
    return shaderModule;
  }

  setupMaterial(
    material: GLTFMaterialDescriptor,
    materialGpuData: Map<GLTFMaterialDescriptor, { bindGroup: GPUBindGroup }>,
  ) {
    const pbr = material.pbrMetallicRoughness;

    // Set up material buffer.
    const valueCount = 5;
    const materialUniformBuffer = this.device.createBuffer({
      label: `"${material.name}"`,
      size: alignTo(valueCount, 4) * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.UNIFORM,
      mappedAtCreation: true,
    });
    const materialBufferArray = new Float32Array(
      materialUniformBuffer.getMappedRange(),
    );
    materialBufferArray.set([
      ...(pbr.baseColorFactor ?? [1, 1, 1, 1]),
      material.alphaCutoff ?? 0.5,
    ]);
    materialUniformBuffer.unmap();

    // The baseColorTexture may not be specified either. If not use a plain
    // white texture instead.
    const albedoIndex = pbr?.baseColorTexture?.index;
    let albedo =
      albedoIndex !== undefined
        ? {
            texture: this.textures[albedoIndex].texture,
            sampler: this.textures[albedoIndex].sampler,
          }
        : {
            // There's a trick here: in fragment shader I am multiplying
            //baseColorTexture and baseColorFactor. Both have all values set to
            // 1 so usually either of them is defined and the other is neutral
            // to the multiplication.
            texture: this.opaqueWhiteTexture,
            sampler: this.defaultSampler,
          };

    const roughnessMetallicIndex = pbr?.metallicRoughnessTexture?.index;

    // Those two values are not random. They appear to be default values in
    // glTF, at least exported from Blender.
    const roughnessFactor = pbr?.roughnessFactor ?? 0.5;
    const metallicFactor = pbr?.metallicFactor ?? 1;

    const roughnessMetallic =
      roughnessMetallicIndex !== undefined
        ? {
            texture: this.textures[roughnessMetallicIndex].texture,
            sampler: this.textures[roughnessMetallicIndex].sampler,
          }
        : {
            texture: this.getRoughnessMetallicTexture(
              roughnessFactor,
              metallicFactor,
            ),
            sampler: this.defaultSampler,
          };

    const aoIndex = material.occlusionTexture?.index;
    const ao =
      aoIndex !== undefined
        ? {
            texture: this.textures[aoIndex].texture,
            sampler: this.textures[aoIndex].sampler,
          }
        : {
            texture: this.opaqueWhiteTexture,
            sampler: this.defaultSampler,
          };

    const normalIndex = material.normalTexture?.index;
    const normal =
      normalIndex !== undefined
        ? {
            texture: this.textures[normalIndex].texture,
            sampler: this.textures[normalIndex].sampler,
          }
        : {
            texture: this.defaultNormalTexture,
            sampler: this.defaultSampler,
          };

    const emissiveIndex = material.emissiveTexture?.index;
    const emissive =
      emissiveIndex !== undefined
        ? {
            texture: this.textures[emissiveIndex].texture,
            sampler: this.textures[emissiveIndex].sampler,
          }
        : {
            texture: this.transparentBlackTexture,
            sampler: this.defaultSampler,
          };

    const bindGroup = this.device.createBindGroup({
      label: `"${material.name}"`,
      layout: this.bindGroupLayouts.material,
      entries: [
        // Material uniforms
        {
          binding: 0,
          resource: { buffer: materialUniformBuffer },
        },
        // Albedo
        {
          binding: 1,
          resource: albedo.sampler,
        },
        {
          binding: 2,
          resource: albedo.texture.createView(),
        },
        // Normal
        {
          binding: 3,
          resource: normal.sampler,
        },
        {
          binding: 4,
          resource: normal.texture.createView(),
        },
        // RoughnessMetallic
        {
          binding: 5,
          resource: roughnessMetallic.sampler,
        },
        {
          binding: 6,
          resource: roughnessMetallic.texture.createView(),
        },
        // AO
        {
          binding: 7,
          resource: ao.sampler,
        },
        {
          binding: 8,
          resource: ao.texture.createView(),
        },
        // Emissive
        {
          binding: 9,
          resource: emissive.sampler,
        },
        {
          binding: 10,
          resource: emissive.texture.createView(),
        },
      ],
    });

    // Associate the bind group with this material.
    materialGpuData.set(material, { bindGroup });
  }

  getRoughnessMetallicTexture(roughness: number, metallic: number) {
    const key = `R=${roughness}, M=${metallic}`;
    let texture = this.roughnessMetallicTextures.get(key);
    if (texture) {
      return texture;
    }

    texture = createRoughnessMetallicTexture(this.device, roughness, metallic);
    this.roughnessMetallicTextures.set(key, texture);
    return texture;
  }

  setupPrimitiveInstances(
    primitive: GLTFPrimitiveDescriptor,
    primitiveInstances: PrimitiveInstances,
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
    mesh: GLTFMeshDescriptor,
    primitive: GLTFPrimitiveDescriptor,
    gltf: GLTFDescriptor,
    primitiveInstances: PrimitiveInstances,
    materialGpuData: Map<GLTFMaterialDescriptor, { bindGroup: GPUBindGroup }>,
  ) {
    const bufferLayout = new Map<string | number, GPUVertexBufferLayout>();
    const gpuBuffers = new Map<
      GPUVertexBufferLayout,
      { buffer: GPUBuffer; offset: number }
    >();
    for (const [attributeName, accessorIndex] of Object.entries(
      primitive.attributes,
    )) {
      const accessor = gltf.accessors[accessorIndex];
      const bufferView = gltf.bufferViews[accessor.bufferView];

      const shaderLocation = ShaderLocations[attributeName];

      if (shaderLocation === undefined) {
        console.warn(`Unknown shader location ${attributeName}.`);
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
          buffer,
        );

        const gpuBuffer = this.device.createBuffer({
          label: `"${mesh.name}" ${attributeName} primitive`,
          size: alignTo(bufferView.byteLength, 4),
          usage: GPUBufferUsage.VERTEX,
          mappedAtCreation: true,
        });
        new Uint8Array(gpuBuffer.getMappedRange()).set(
          gltf.buffers[0].subarray(
            bufferView.byteOffset,
            bufferView.byteOffset + bufferView.byteLength,
          ),
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
        },
      );
    }

    const sortedBufferLayout = [...bufferLayout.values()].sort(
      (a: GPUVertexBufferLayout, b: GPUVertexBufferLayout) => {
        // @ts-ignore Property '0' does not exist on type 'Iterable<GPUVertexAttribute>'.ts(7053)
        return a.attributes[0].shaderLocation - b.attributes[0].shaderLocation;
      },
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
      bufferView.byteOffset + bufferView.byteLength,
    );

    const indexBuffer = this.device.createBuffer({
      label: `"${mesh.name}" index`,
      size: alignTo(bufferView.byteLength, 4),
      usage: GPUBufferUsage.INDEX,
      mappedAtCreation: true,
    });
    new Uint8Array(indexBuffer.getMappedRange()).set(view);
    indexBuffer.unmap();

    invariant("indices" in primitive, "Primitive must have indices.");
    invariant(
      primitive.material !== undefined,
      "Primitive must have material.",
    );
    const material = (gltf.materials ?? [])[primitive.material];
    const gpuMaterial = materialGpuData.get(material);
    invariant(gpuMaterial, "Material not found.");

    const pipeline = this.getPipelineForPrimitive({
      buffers: sortedBufferLayout,
      doubleSided: material.doubleSided ?? false,
      alphaMode: material.alphaMode ?? "OPAQUE",
      shaderParameters: {
        hasUVs: "TEXCOORD_0" in primitive.attributes,
        hasTangents: "TANGENT" in primitive.attributes,
        useAlphaCutoff: material.alphaMode == "MASK",
      },
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

    let materialPrimitives = pipeline.materialPrimitives.get(gpuMaterial);
    if (!materialPrimitives) {
      materialPrimitives = [];
      pipeline.materialPrimitives.set(gpuMaterial, materialPrimitives);
    }
    materialPrimitives.push(gpuPrimitive);
  }

  getTRS(node: GLTFNodeDescriptor) {
    if (node.matrix) {
      return new Mat4(node.matrix);
    } else {
      const translation = node.translation
        ? Mat4.translate(
            node.translation[0],
            node.translation[1],
            node.translation[2],
          )
        : Mat4.identity();

      const rotation = node.rotation
        ? Mat4.rotateFromQuat(
            new Vec4(
              node.rotation[0],
              node.rotation[1],
              node.rotation[2],
              node.rotation[3],
            ),
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

    // This is usually a mesh which has children and it just defines a transform
    // but doesn't have any primitives.
    if (!mesh) {
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
    const commandEncoder = this.device.createCommandEncoder({
      label: "glTF scene",
    });
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
      1000,
    );
    const view = this.camera.getView().invert();
    const cameraUniforms = new Float32Array([
      ...projection.data,
      ...view.data,
      ...this.camera.getPosition().data(),
      performance.now(),
    ]);

    this.device.queue.writeBuffer(this.cameraUniformBuffer, 0, cameraUniforms);

    passEncoder.setBindGroup(0, this.bindGroups.camera);
    passEncoder.setBindGroup(1, this.bindGroups.instance);
    passEncoder.setBindGroup(3, this.bindGroups.pbr);

    for (const gpuPipeline of this.pipelineGpuData.values()) {
      passEncoder.setPipeline(gpuPipeline.pipeline);

      for (const [
        material,
        primitives,
      ] of gpuPipeline.materialPrimitives.entries()) {
        passEncoder.setBindGroup(2, material.bindGroup);

        for (const gpuPrimitive of primitives) {
          for (const [bufferIndex, gpuBuffer] of Object.entries(
            gpuPrimitive.buffers,
          )) {
            passEncoder.setVertexBuffer(
              Number(bufferIndex),
              gpuBuffer.buffer,
              gpuBuffer.offset,
            );
          }
          passEncoder.setIndexBuffer(
            gpuPrimitive.indexBuffer,
            gpuPrimitive.indexType,
            gpuPrimitive.indexOffset,
          );

          passEncoder.drawIndexed(
            gpuPrimitive.drawCount,
            gpuPrimitive.instances.count,
            0,
            0,
            gpuPrimitive.instances.first,
          );
        }
      }
    }
    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }
}
