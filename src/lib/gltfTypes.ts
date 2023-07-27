export const ShaderLocations: Record<string, number> = {
  POSITION: 0,
  NORMAL: 1,
  TEXCOORD_0: 2,
  TANGENT: 3,
};

export enum ComponentType {
  BYTE = 5120,
  UNSIGNED_BYTE = 5121,
  SHORT = 5122,
  UNSIGNED_SHORT = 5123,
  UNSIGNED_INT = 5125,
  FLOAT = 5126,
}

export type GLTFMeshDescriptor = {
  name: string;
  primitives: GLTFPrimitiveDescriptor[];
};

export type GLTFBufferViewDescriptor = {
  buffer: number;
  byteLength: number;
  byteOffset: number;
  target: number;
  byteStride?: number;
};

export type GLTFMaterialDescriptor = {
  name: string;
  pbrMetallicRoughness: {
    baseColorFactor: [number, number, number, number];
    metallicFactor: number;
    roughnessFactor: number;
    baseColorTexture?: { index: number };
    metallicRoughnessTexture?: { index: number };
  };
  normalTexture?: { index: number };
  occlusionTexture?: { index: number };
  emissiveTexture?: { index: number };
  doubleSided?: boolean;
  alphaMode?: "OPAQUE" | "MASK" | "BLEND";
  alphaCutoff?: number;
};

export type GLTFAccessorDescriptor = {
  bufferView: number;
  componentType: ComponentType;
  count: number;
  type: "SCALAR" | "VEC2" | "VEC3" | "VEC4";
  normalized?: boolean;
  byteOffset?: number;
  min?: number[];
  max?: number[];
};

export type GLTFSamplerDescriptor = {
  magFilter?: number;
  minFilter?: number;
  wrapS?: number;
  wrapT?: number;
};

export type GLTFImageDescriptor = {
  bufferView: number;
  mimeType: string;
  name: string;
};

export type GLTFTextureDescriptor = {
  sampler: number;
  source: number;
};

export type GLTFPrimitiveDescriptor = {
  attributes: {
    POSITION: number;
    NORMAL: number;
    TEXCOORD_0: number;
  };
  indices: number;
  material?: number;
};

export type GLTFNodeDescriptor = {
  mesh: number;
  name: string;
  children?: number[];
  matrix?: number[];
  rotation?: [number, number, number, number];
  scale?: [number, number, number];
  translation?: [number, number, number];
};

export type GLTFDescriptor = {
  asset: {
    generator: string;
    version: string;
  };
  scene: number;
  scenes: {
    nodes: number[];
  }[];
  nodes: GLTFNodeDescriptor[];
  meshes: GLTFMeshDescriptor[];
  images?: GLTFImageDescriptor[];
  textures?: GLTFTextureDescriptor[];
  samplers?: GLTFSamplerDescriptor[];
  materials?: GLTFMaterialDescriptor[];
  accessors: GLTFAccessorDescriptor[];
  bufferViews: GLTFBufferViewDescriptor[];
  buffers: Uint8Array[];
};
