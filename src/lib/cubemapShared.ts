import { Vec3 } from "./math/Vec3";
import { Mat4 } from "./math/Mat4";

export const cubemapViewMatrices = [
  Mat4.lookAt(
    new Vec3(0.0, 0.0, 0.0),
    new Vec3(1.0, 0.0, 0.0),
    new Vec3(0.0, -1.0, 0.0),
  ).invert(),
  Mat4.lookAt(
    new Vec3(0.0, 0.0, 0.0),
    new Vec3(-1.0, 0.0, 0.0),
    new Vec3(0.0, -1.0, 0.0),
  ).invert(),
  Mat4.lookAt(
    new Vec3(0.0, 0.0, 0.0),
    new Vec3(0.0, -1.0, 0.0),
    new Vec3(0.0, 0.0, -1.0),
  ).invert(),
  Mat4.lookAt(
    new Vec3(0.0, 0.0, 0.0),
    new Vec3(0.0, 1.0, 0.0),
    new Vec3(0.0, 0.0, 1.0),
  ).invert(),
  Mat4.lookAt(
    new Vec3(0.0, 0.0, 0.0),
    new Vec3(0.0, 0.0, 1.0),
    new Vec3(0.0, -1.0, 0.0),
  ).invert(),
  Mat4.lookAt(
    new Vec3(0.0, 0.0, 0.0),
    new Vec3(0.0, 0.0, -1.0),
    new Vec3(0.0, -1.0, 0.0),
  ).invert(),
];

// I am not exactly sure why but I had to modify matrices for prefitered env map
// and irradiance map.
export const cubemapViewMatricesInverted = [
  Mat4.lookAt(
    new Vec3(0.0, 0.0, 0.0),
    new Vec3(1.0, 0.0, 0.0),
    new Vec3(0.0, 1.0, 0.0),
  ),
  Mat4.lookAt(
    new Vec3(0.0, 0.0, 0.0),
    new Vec3(-1.0, 0.0, 0.0),
    new Vec3(0.0, 1.0, 0.0),
  ),
  Mat4.lookAt(
    new Vec3(0.0, 0.0, 0.0),
    new Vec3(0.0, 1.0, 0.0),
    new Vec3(0.0, 0.0, -1.0),
  ),
  Mat4.lookAt(
    new Vec3(0.0, 0.0, 0.0),
    new Vec3(0.0, -1.0, 0.0),
    new Vec3(0.0, 0.0, 1.0),
  ),
  Mat4.lookAt(
    new Vec3(0.0, 0.0, 0.0),
    new Vec3(0.0, 0.0, 1.0),
    new Vec3(0.0, 1.0, 0.0),
  ),
  Mat4.lookAt(
    new Vec3(0.0, 0.0, 0.0),
    new Vec3(0.0, 0.0, -1.0),
    new Vec3(0.0, 1.0, 0.0),
  ),
];

// prettier-ignore
export const cubeVertexArray = new Float32Array([
  1, -1, 1, 1,
  -1, -1, 1, 1,
  -1, -1, -1, 1,
  1, -1, -1, 1,
  1, -1, 1, 1,
  -1, -1, -1, 1,

  1, 1, 1, 1,
  1, -1, 1, 1,
  1, -1, -1, 1,
  1, 1, -1, 1,
  1, 1, 1, 1,
  1, -1, -1, 1,

  -1, 1, 1, 1,
  1, 1, 1, 1,
  1, 1, -1, 1,
  -1, 1, -1, 1,
  -1, 1, 1, 1,
  1, 1, -1, 1,

  -1, -1, 1, 1,
  -1, 1, 1, 1,
  -1, 1, -1, 1,
  -1, -1, -1, 1,
  -1, -1, 1, 1,
  -1, 1, -1, 1,

  1, 1, 1, 1,
  -1, 1, 1, 1,
  -1, -1, 1, 1,
  -1, -1, 1, 1,
  1, -1, 1, 1,
  1, 1, 1, 1,

  1, -1, -1, 1,
  -1, -1, -1, 1,
  -1, 1, -1, 1,
  1, 1, -1, 1,
  1, -1, -1, 1,
  -1, 1, -1, 1,
]);

export const cubemapVertexShader = /* wgsl */ `
struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) worldPosition: vec4f,
};

struct Uniforms {
  modelViewProjectionMatrix: mat4x4f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn main(@location(0) position: vec4f) -> VSOut {
  var output: VSOut;
  output.position = uniforms.modelViewProjectionMatrix * position;
  output.worldPosition = position;
  return output;
}
`;
