import { ShaderLocations } from "../gltfTypes";
import {
  distributionGGX,
  fresnelSchlick,
  fresnelSchlickRoughness,
  geometrySchlickGGX,
  geometrySmith,
  toneMappings,
} from "../pbrShaderFunctions";
import { wgsl } from "../wgslPreprocessor";

export function createPBRShader({
  hasUVs,
  hasTangents,
  useAlphaCutoff,
}: {
  hasUVs: boolean;
  hasTangents: boolean;
  useAlphaCutoff: boolean;
}) {
  return wgsl/* wgsl */ `
    struct Scene {
      cameraProjection: mat4x4f,
      cameraView: mat4x4f,
      cameraPosition: vec3f,
      lightPosition: vec3f,
      lightColor: vec3f,
      lightViewProjection: mat4x4f,
    };

    struct Material {
      baseColorFactor: vec4f,
      alphaCutoff: f32,
    };

    @group(0) @binding(0) var<uniform> scene: Scene;

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
    @group(3) @binding(5) var shadowMap: texture_depth_2d;
    @group(3) @binding(6) var shadowSampler: sampler_comparison;

    struct VertexInput {
      @location(${ShaderLocations.POSITION}) position: vec4f,
      @location(${ShaderLocations.NORMAL}) normal: vec3f,
      #if ${hasUVs}
      @location(${ShaderLocations.TEXCOORD_0}) uv: vec2f,
      #endif
      #if ${hasTangents}
      @location(${ShaderLocations.TANGENT}) tangent: vec4f,
      #endif
    }

    struct VertexOutput {
      @builtin(position) position: vec4f,
      @location(0) normal: vec3f,
      @location(1) uv: vec2f,
      @location(2) worldPosition: vec3f,
      @location(3) shadowPosition: vec3f,
      #if ${hasTangents}
      @location(4) tangent: vec4f,
      #endif
    };

    @vertex
    fn vertexMain(input: VertexInput, @builtin(instance_index) instance: u32) -> VertexOutput {
      let positionFromLight = scene.lightViewProjection * models[instance] * input.position;

      var output: VertexOutput;
      output.position = scene.cameraProjection * scene.cameraView * models[instance] * input.position;
      output.normal = normalize((models[instance] * vec4f(input.normal, 0.0)).xyz);
      output.shadowPosition = vec3f(
        positionFromLight.xy * vec2f(0.5, -0.5) + vec2f(0.5),
        positionFromLight.z
      );

      #if ${hasUVs}
      output.uv = input.uv;
      #else
      output.uv = vec2f(0);
      #endif

      #if ${hasTangents}
      output.tangent = models[instance] * input.tangent;
      #endif

      return output;
    }

    ${distributionGGX}
    ${geometrySchlickGGX}
    ${geometrySmith}
    ${fresnelSchlick}
    ${fresnelSchlickRoughness}
    ${toneMappings.aces}

    const MAX_REFLECTION_LOD = 4.0;
    const PI = 3.14159265359;

    fn calculateShadows(shadowPosition: vec3f) -> f32 {
      var visibility = 0.0;
      let oneOverShadowDepthTextureSize = 1.0 / 1024.0;
      for (var y = -1; y <= 1; y++) {
        for (var x = -1; x <= 1; x++) {
          let offset = vec2f(vec2(x, y)) * oneOverShadowDepthTextureSize;
          visibility += textureSampleCompare(shadowMap, shadowSampler, shadowPosition.xy + offset, shadowPosition.z - 0.007);
        }
      }
      visibility /= 9.0;

      return visibility;
    }

    @fragment
    fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
      let visibility = calculateShadows(input.shadowPosition);
      let baseColor = textureSample(albedoTexture, albedoSampler, input.uv) * material.baseColorFactor;

      #if ${useAlphaCutoff}
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

      #if ${hasTangents}
      var n = normalize(input.normal);
      let t = normalize(input.tangent.xyz);
      let b = cross(n, t) * input.tangent.w;
      let tbn = mat3x3f(t, b, n);
      n = normalize(tbn * normal);
      #else
      let n = normalize(input.normal);
      #endif

      let v = normalize(scene.cameraPosition - input.worldPosition);
      let r = reflect(-v, n);

      let f0 = mix(vec3f(0.04), albedo, metallic);

      var lo = vec3f(0.0);

      // This could be a loop if there were more lights.
      {
        let l = normalize(scene.lightPosition - input.worldPosition);
        let h = normalize(v + l);

        let distance = length(scene.lightPosition - input.worldPosition);
        let attenuation = 1.0 / (distance * distance);
        let radiance = scene.lightColor * attenuation;

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
        lo += (kD * albedo / PI + specular) * radiance * nDotL * visibility;
      }
      // Loop would end here.

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

      if (visibility < 0.5) {
        return vec4f(ambient, 1.0);
      }
      var color = ambient + lo + emissive;
      color = toneMapping(color);
      color = pow(color, vec3f(1.0 / 2.2));
      return vec4f(color, 1.0);
    }
    `;
}
