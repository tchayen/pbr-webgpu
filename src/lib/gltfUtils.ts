import {
  ComponentType,
  GLTFAccessorDescriptor,
  GLTFDescriptor,
  GLTFImageDescriptor,
  GLTFSamplerDescriptor,
} from "./gltfTypes";

function numerOfComponentsForType(type: string) {
  switch (type) {
    case "SCALAR":
      return 1;
    case "VEC2":
      return 2;
    case "VEC3":
      return 3;
    case "VEC4":
      return 4;
    default:
      throw new Error(`Unknown type ${type}`);
  }
}

export function gpuFormatForAccessor(
  accessor: GLTFAccessorDescriptor
): GPUVertexFormat {
  const normalized = accessor.normalized ? "norm" : "int";
  const count = numerOfComponentsForType(accessor.type);
  const multiplier = count > 1 ? `x${count}` : "";

  switch (accessor.componentType) {
    case ComponentType.BYTE:
      return `s${normalized}8${multiplier}` as GPUVertexFormat;
    case ComponentType.UNSIGNED_BYTE:
      return `u${normalized}8${multiplier}` as GPUVertexFormat;
    case ComponentType.SHORT:
      return `s${normalized}16${multiplier}` as GPUVertexFormat;
    case ComponentType.UNSIGNED_SHORT:
      return `u${normalized}16${multiplier}` as GPUVertexFormat;
    case ComponentType.UNSIGNED_INT:
      return `u${normalized}32${multiplier}` as GPUVertexFormat;
    case ComponentType.FLOAT:
      return `float32${multiplier}` as GPUVertexFormat;
    default:
      throw new Error(`Unknown component type ${accessor.componentType}`);
  }
}

export function gpuIndexFormatForComponentType(
  componentType: ComponentType
): GPUIndexFormat {
  switch (componentType) {
    case ComponentType.UNSIGNED_SHORT:
      return "uint16";
    case ComponentType.UNSIGNED_INT:
      return "uint32";
    default:
      throw new Error(`Unknown component type ${componentType}`);
  }
}

function componentTypeSizeInBytes(componentType: ComponentType) {
  switch (componentType) {
    case ComponentType.BYTE:
    case ComponentType.UNSIGNED_BYTE:
      return 1;
    case ComponentType.SHORT:
    case ComponentType.UNSIGNED_SHORT:
      return 2;
    case ComponentType.UNSIGNED_INT:
    case ComponentType.FLOAT:
      return 4;
    default:
      throw new Error(`Unknown component type ${componentType}`);
  }
}

export function packedArrayStrideForAccessor(accessor: GLTFAccessorDescriptor) {
  return (
    numerOfComponentsForType(accessor.type) *
    componentTypeSizeInBytes(accessor.componentType)
  );
}

export function gpuAddressModeForWrappingMode(mode?: number) {
  switch (mode) {
    case WebGLRenderingContext.CLAMP_TO_EDGE:
      return "clamp-to-edge";
    case WebGLRenderingContext.MIRRORED_REPEAT:
      return "mirror-repeat";
    case WebGLRenderingContext.REPEAT:
      return "repeat";
    default:
      return "repeat";
  }
}

export function createSampler(
  device: GPUDevice,
  sampler: GLTFSamplerDescriptor
) {
  const descriptor: GPUSamplerDescriptor = {
    addressModeU: gpuAddressModeForWrappingMode(sampler.wrapS),
    addressModeV: gpuAddressModeForWrappingMode(sampler.wrapT),
  };

  if (
    !sampler.magFilter ||
    sampler.magFilter === WebGLRenderingContext.LINEAR
  ) {
    descriptor.magFilter = "linear";
  }

  switch (sampler.minFilter) {
    case WebGLRenderingContext.NEAREST:
      break;
    case WebGLRenderingContext.LINEAR:
    case WebGLRenderingContext.LINEAR_MIPMAP_NEAREST:
      descriptor.minFilter = "linear";
      break;
    case WebGLRenderingContext.NEAREST_MIPMAP_LINEAR:
      descriptor.mipmapFilter = "linear";
      break;
    case WebGLRenderingContext.LINEAR_MIPMAP_LINEAR:
    default:
      descriptor.minFilter = "linear";
      descriptor.mipmapFilter = "linear";
      break;
  }

  return device.createSampler(descriptor);
}

export function createDefaultSampler(device: GPUDevice) {
  return device.createSampler({
    addressModeU: "repeat",
    addressModeV: "repeat",
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
  });
}

export async function createTextureFromImage(
  device: GPUDevice,
  gltf: GLTFDescriptor,
  image: GLTFImageDescriptor
) {
  const bufferView = gltf.bufferViews[image.bufferView];
  const buffer = gltf.buffers[bufferView.buffer];
  const blob = new Blob(
    [
      buffer.subarray(
        bufferView.byteOffset,
        bufferView.byteOffset + bufferView.byteLength
      ),
    ],
    { type: image.mimeType }
  );
  const imageBitmap = await createImageBitmap(blob);

  const size = { width: imageBitmap.width, height: imageBitmap.height };

  const texture = device.createTexture({
    size,
    format: "rgba8unorm",
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  device.queue.copyExternalImageToTexture(
    { source: imageBitmap },
    { texture },
    size
  );

  return texture;
}

export function createSolidColorTexture(
  device: GPUDevice,
  r: number,
  g: number,
  b: number,
  a: number
) {
  const data = new Uint8Array([r * 255, g * 255, b * 255, a * 255]);
  const size = { width: 1, height: 1 };
  const texture = device.createTexture({
    size,
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  device.queue.writeTexture({ texture }, data, {}, size);
  return texture;
}
