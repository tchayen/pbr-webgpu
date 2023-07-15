export function createBuffer(
  device: GPUDevice,
  array: Float32Array | Uint16Array,
  usage: number,
) {
  // Align to 4 bytes.
  const buffer = device.createBuffer({
    size: (array.byteLength + 3) & ~3,
    usage,
    mappedAtCreation: true,
  });
  const writeArray =
    array instanceof Uint16Array
      ? new Uint16Array(buffer.getMappedRange())
      : new Float32Array(buffer.getMappedRange());
  writeArray.set(array);
  buffer.unmap();

  return buffer;
}
