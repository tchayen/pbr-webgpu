import { GLTFDescriptor } from "./gltfTypes";
import { invariant } from "./invariant";
import { printHex } from "./printHex";

export function readGlb(data: ArrayBuffer): GLTFDescriptor {
  let pointer = 0;

  function readUint32LE() {
    const result = new DataView(data, pointer, 4).getUint32(0, true);
    pointer += 4;
    return result;
  }

  const magic = readUint32LE();
  invariant(
    magic === 0x46546c67,
    `Magic must be glTF (expected: 0x46546c67, found: ${printHex(magic)}).`,
  );
  const version = readUint32LE();
  invariant(version === 2, `Version must be 2 (found: ${version}).`);
  const length = readUint32LE();

  const jsonLength = readUint32LE();
  const jsonType = readUint32LE();
  invariant(
    jsonType === 0x4e4f534a,
    `JSON type must be JSON (expected: 0x4e4f534a, found: ${printHex(
      jsonType,
    )}).`,
  );

  const jsonData = new Uint8Array(data, pointer, jsonLength);
  pointer += jsonLength;

  const binaryLength = readUint32LE();
  const binaryType = readUint32LE();

  invariant(
    binaryType === 0x004e4942,
    `Binary type must be BIN (expected: 0x004e4942, found: ${printHex(
      binaryType,
    )}).`,
  );

  const binaryData = new Uint8Array(data, pointer, binaryLength);

  const json = JSON.parse(new TextDecoder().decode(jsonData));
  // invariant(isGltfDescriptor(json), "Invalid glTF descriptor.");

  invariant(json.buffers.length === 1, "Only one buffer is supported.");
  json.buffers = [binaryData];

  return json;
}
