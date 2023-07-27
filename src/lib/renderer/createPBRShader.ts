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
        #if ${hasTangents}
        @location(3) tangent: vec4f,
        #endif
      };

      @vertex
      fn vertexMain(input: VertexInput, @builtin(instance_index) instance: u32) -> VertexOutput {
        var output: VertexOutput;
        output.position = camera.projection * camera.view * models[instance] * input.position;
        output.normal = normalize((models[instance] * vec4f(input.normal, 0.0)).xyz);
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
    `;
}
