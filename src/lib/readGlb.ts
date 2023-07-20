import { invariant } from "./invariant";
import { printHex } from "./printHex";

export enum ComponentType {
  BYTE = 5120,
  UNSIGNED_BYTE = 5121,
  SHORT = 5122,
  UNSIGNED_SHORT = 5123,
  UNSIGNED_INT = 5125,
  FLOAT = 5126,
}

export type GLTFBufferViewDescriptor = {
  buffer: number;
  byteLength: number;
  byteOffset: number;
  target: number;
  byteStride?: number;
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

export type GLTFPrimitiveDescriptor = {
  attributes: {
    POSITION: number;
    NORMAL: number;
    TEXCOORD_0: number;
  };
  indices: number;
};

export type GLTFNodeDescriptor = {
  mesh: number;
  name: string;
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
  meshes: {
    primitives: GLTFPrimitiveDescriptor[];
  }[];
  accessors: GLTFAccessorDescriptor[];
  bufferViews: GLTFBufferViewDescriptor[];
  buffers: Uint8Array[];
};

export function readGlb(data: ArrayBuffer) {
  let pointer = 0;

  function readUint32LE() {
    const result = new DataView(data, pointer, 4).getUint32(0, true);
    pointer += 4;
    return result;
  }

  const magic = readUint32LE();
  invariant(
    magic === 0x46546c67,
    `Magic must be glTF (expected: 0x46546c67, found: ${printHex(magic)}).`
  );
  const version = readUint32LE();
  invariant(version === 2, `Version must be 2 (found: ${version}).`);
  const length = readUint32LE();

  const jsonLength = readUint32LE();
  const jsonType = readUint32LE();
  invariant(
    jsonType === 0x4e4f534a,
    `JSON type must be JSON (expected: 0x4e4f534a, found: ${printHex(
      jsonType
    )}).`
  );

  const jsonData = new Uint8Array(data, pointer, jsonLength);
  pointer += jsonLength;

  const binaryLength = readUint32LE();
  const binaryType = readUint32LE();

  invariant(
    binaryType === 0x004e4942,
    `Binary type must be BIN (expected: 0x004e4942, found: ${printHex(
      binaryType
    )}).`
  );

  const binaryData = new Uint8Array(data, pointer, binaryLength);

  const json = JSON.parse(new TextDecoder().decode(jsonData));
  // invariant(isGltfDescriptor(json), "Invalid glTF descriptor.");

  invariant(json.buffers.length === 1, "Only one buffer is supported.");
  json.buffers = [binaryData];

  return json;
}

/**
 * Generated by copilot. Adjust if needed. Meant to spot format inconsistencies early on.
 */
function isGltfDescriptor(obj: any): obj is GLTFDescriptor {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof obj.asset === "object" &&
    typeof obj.asset.generator === "string" &&
    typeof obj.asset.version === "string" &&
    typeof obj.scene === "number" &&
    Array.isArray(obj.scenes) &&
    obj.scenes.every(
      (scene: any) =>
        typeof scene === "object" &&
        scene !== null &&
        Array.isArray(scene.nodes) &&
        scene.nodes.every((node: any) => typeof node === "number")
    ) &&
    Array.isArray(obj.nodes) &&
    obj.nodes.every(
      (node: any) =>
        typeof node === "object" &&
        node !== null &&
        typeof node.mesh === "number" &&
        typeof node.name === "string" &&
        (typeof node.rotation === "undefined" ||
          (Array.isArray(node.rotation) && node.rotation.length === 4)) &&
        (typeof node.scale === "undefined" ||
          (Array.isArray(node.scale) && node.scale.length === 3)) &&
        (typeof node.translation === "undefined" ||
          (Array.isArray(node.translation) && node.translation.length === 3))
    ) &&
    Array.isArray(obj.meshes) &&
    obj.meshes.every(
      (mesh: any) =>
        typeof mesh === "object" &&
        mesh !== null &&
        Array.isArray(mesh.primitives) &&
        mesh.primitives.every(
          (primitive: any) =>
            typeof primitive === "object" &&
            primitive !== null &&
            typeof primitive.indices === "number" &&
            typeof primitive.attributes === "object" &&
            typeof primitive.attributes.POSITION === "number" &&
            typeof primitive.attributes.NORMAL === "number" &&
            typeof primitive.attributes.TEXCOORD_0 === "number"
        )
    ) &&
    Array.isArray(obj.accessors) &&
    obj.accessors.every(
      (accessor: any) =>
        typeof accessor === "object" &&
        accessor !== null &&
        typeof accessor.bufferView === "number" &&
        typeof accessor.componentType === "number" &&
        typeof accessor.count === "number" &&
        typeof accessor.type === "string" &&
        (typeof accessor.min === "undefined" ||
          (Array.isArray(accessor.min) &&
            accessor.min.length === 3 &&
            accessor.min.every((n: number) => typeof n === "number"))) &&
        (typeof accessor.max === "undefined" ||
          (Array.isArray(accessor.max) &&
            accessor.max.length === 3 &&
            accessor.max.every((n: number) => typeof n === "number")))
    ) &&
    Array.isArray(obj.bufferViews) &&
    obj.bufferViews.every(
      (bufferView: any) =>
        typeof bufferView === "object" &&
        bufferView !== null &&
        typeof bufferView.buffer === "number" &&
        typeof bufferView.byteLength === "number" &&
        typeof bufferView.byteOffset === "number" &&
        typeof bufferView.target === "number"
    ) &&
    Array.isArray(obj.buffers) &&
    obj.buffers.every(
      (buffer: any) =>
        typeof buffer === "object" &&
        buffer !== null &&
        typeof buffer.byteLength === "number"
    )
  );
}
