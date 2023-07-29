import {
  geometrySmith,
  hammersley,
  importanceSampleGGX,
  radicalInverseVdC,
} from "./pbrShaderFunctions";
import { createBuffer } from "./createBuffer";

const vertexShader = /* wgsl */ `
struct VertexOutput {
  @builtin(position) Position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn main(@location(0) position: vec3f, @location(1) uv: vec2f) -> VertexOutput {
  var output: VertexOutput;
  output.Position = vec4f(position, 1.0);
  output.uv = uv;
  return output;
}
`;

// https://learnopengl.com/code_viewer_gh.php?code=src/6.pbr/2.2.1.ibl_specular/2.2.1.brdf.fs
const fragmentShader = /* wgsl */ `
const PI: f32 = 3.14159265359;

${radicalInverseVdC}
${hammersley}
${importanceSampleGGX}
${geometrySmith}

// This one is different
fn geometrySchlickGGX(nDotV: f32, roughness: f32) -> f32 {
  let a = roughness;
  let k = (a * a) / 2.0;

  let nom = nDotV;
  let denom = nDotV * (1.0 - k) + k;

  return nom / denom;
}

fn integrateBRDF(NdotV: f32, roughness: f32) -> vec2f {
  var V: vec3f;
  V.x = sqrt(1.0 - NdotV * NdotV);
  V.y = 0.0;
  V.z = NdotV;

  var A: f32 = 0.0;
  var B: f32 = 0.0;

  let N = vec3f(0.0, 0.0, 1.0);

  let SAMPLE_COUNT: u32 = 1024u;
  for(var i: u32 = 0u; i < SAMPLE_COUNT; i = i + 1u) {
      let Xi: vec2f = hammersley(i, SAMPLE_COUNT);
      let H: vec3f = importanceSampleGGX(Xi, N, roughness);
      let L: vec3f = normalize(2.0 * dot(V, H) * H - V);

      let NdotL: f32 = max(L.z, 0.0);
      let NdotH: f32 = max(H.z, 0.0);
      let VdotH: f32 = max(dot(V, H), 0.0);

      if(NdotL > 0.0) {
          let G: f32 = geometrySmith(N, V, L, roughness);
          let G_Vis: f32 = (G * VdotH) / (NdotH * NdotV);
          let Fc: f32 = pow(1.0 - VdotH, 5.0);

          A += (1.0 - Fc) * G_Vis;
          B += Fc * G_Vis;
      }
  }
  A /= f32(SAMPLE_COUNT);
  B /= f32(SAMPLE_COUNT);
  return vec2f(A, B);
}

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec2f {
  let result = integrateBRDF(uv.x, 1 - uv.y);
  return result;
}
`;

// prettier-ignore
export const quadVertices = new Float32Array([
  -1.0, -1.0, 0.0, 0.0, 0.0,
  1.0, -1.0, 0.0, 1.0, 0.0,
  1.0, 1.0, 0.0, 1.0, 1.0,
  -1.0, -1.0, 0.0, 0.0, 0.0,
  1.0, 1.0, 0.0, 1.0, 1.0,
  -1.0, 1.0, 0.0, 0.0, 1.0
]);

export function getBRDFConvolutionLUT(device: GPUDevice, size: number) {
  const texture = device.createTexture({
    label: "BRDF LUT",
    size: { width: size, height: size },
    format: "rg16float",
    usage:
      GPUTextureUsage.RENDER_ATTACHMENT |
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST,
  });

  const pipeline = device.createRenderPipeline({
    label: "BRDF convolution",
    layout: "auto",
    vertex: {
      module: device.createShaderModule({ code: vertexShader }),
      entryPoint: "main",
      buffers: [
        {
          arrayStride: Float32Array.BYTES_PER_ELEMENT * 5,
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "float32x3",
            },
            {
              shaderLocation: 1,
              offset: Float32Array.BYTES_PER_ELEMENT * 3,
              format: "float32x2",
            },
          ],
        },
      ],
    },
    fragment: {
      module: device.createShaderModule({ code: fragmentShader }),
      entryPoint: "main",
      targets: [{ format: "rg16float" }],
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

  const depthTexture = device.createTexture({
    label: "BRDF LUT depth",
    size: { width: size, height: size },
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const depthTextureView = depthTexture.createView();

  const vertexBuffer = createBuffer(
    device,
    quadVertices,
    GPUBufferUsage.VERTEX,
  );

  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginRenderPass({
    label: "BRDF convolution",
    colorAttachments: [
      {
        view: texture.createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: "clear",
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

  passEncoder.setPipeline(pipeline);
  passEncoder.setVertexBuffer(0, vertexBuffer);
  passEncoder.draw(6);
  passEncoder.end();

  device.queue.submit([commandEncoder.finish()]);

  return texture;
}
