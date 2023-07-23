import { readGlb } from "./lib/readGlb";
import { invariant } from "./lib/invariant";
import { GLTFRenderer } from "./GLTFRenderer";
import { createTextureFromImage } from "./lib/gltfUtils";
import { MipmapGenerator } from "./lib/MipmapGenerator";
import { renderToCubemap } from "./lib/convertEquirectangularToCubemap";
import { getIrradianceMap } from "./lib/getIrradianceMap";
import { getPrefilterMap } from "./lib/getPrefilterMap";
import { getBRDFConvolutionLUT } from "./lib/getBRDFconvolution";
import { GltfPbrRenderer } from "./GltfPbrRenderer";
import { parseHDR } from "./lib/parseHDR";
import { logTime } from "./log";

const config = {
  cubemapSize: 1024,
  irradianceMapSize: 32,
  prefilterMapSize: 256,
  brdfLutSize: 512,
  roughnessLevels: 5,
  sampleCount: 4,
};

export async function setupRendering() {
  const [glb, hdri] = await Promise.all(
    ["/assets/scene4.glb", "/assets/goegap_1k.hdr"].map((url) =>
      fetch(url).then((response) => response.arrayBuffer()),
    ),
  );
  logTime("Downloaded GLB.");

  const gltf = readGlb(glb);
  console.log(gltf);

  const canvas = document.createElement("canvas");
  canvas.width = window.innerWidth * window.devicePixelRatio;
  canvas.height = window.innerHeight * window.devicePixelRatio;
  canvas.style.setProperty("width", `${window.innerWidth}px`);
  canvas.style.setProperty("height", `${window.innerHeight}px`);
  document.body.appendChild(canvas);

  logTime("Created canvas.");

  const context = canvas.getContext("webgpu");
  invariant(context, "WebGPU is not supported in this browser.");

  const entry = navigator.gpu;
  invariant(entry, "WebGPU is not supported in this browser.");

  const adapter = await entry.requestAdapter();
  invariant(adapter, "No GPU found on this system.");

  const device = await adapter.requestDevice({ label: "device" });

  context.configure({
    device,
    format: navigator.gpu.getPreferredCanvasFormat(),
    alphaMode: "opaque",
  });

  logTime("Configured WebGPU.");

  const mipmapGenerator = new MipmapGenerator(device);

  const textures = await Promise.all(
    gltf.images?.map((image) => {
      return createTextureFromImage(device, gltf, image, mipmapGenerator);
    }) ?? [],
  );

  logTime("Loaded textures.");

  const hdr = parseHDR(hdri);
  logTime("Parsed HDRI.");

  const cubemapTexture = renderToCubemap(device, hdr, config.cubemapSize);
  logTime("Generated cubemap from equirectangular.");

  const irradianceMap = getIrradianceMap(
    device,
    cubemapTexture,
    config.irradianceMapSize,
  );
  logTime("Generated irradiance map.");

  const prefilterMap = getPrefilterMap(
    device,
    cubemapTexture,
    config.prefilterMapSize,
    config.roughnessLevels,
  );
  logTime("Generated prefilter map.");

  const brdfLookup = getBRDFConvolutionLUT(device, config.brdfLutSize);
  logTime("Generated BRDF lookup table.");

  const renderer = new GltfPbrRenderer(
    device,
    gltf,
    canvas,
    context,
    textures,
    irradianceMap,
    prefilterMap,
    brdfLookup,
  );

  function render() {
    renderer.render();
    requestAnimationFrame(render);
  }

  render();
}
