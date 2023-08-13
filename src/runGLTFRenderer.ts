import { readGlb } from "./lib/readGlb";
import { invariant } from "./lib/invariant";
import { createTextureFromImage } from "./lib/renderer/utils";
import { MipmapGenerator } from "./lib/MipmapGenerator";
import { renderToCubemap } from "./lib/convertEquirectangularToCubemap";
import { getIrradianceMap } from "./lib/getIrradianceMap";
import { getPrefilterMap } from "./lib/getPrefilterMap";
import { getBRDFConvolutionLUT } from "./lib/getBRDFconvolution";
import { GltfPbrRenderer } from "./lib/renderer/GltfPbrRenderer";
import { parseHDR } from "./lib/parseHDR";
import { logTime } from "./log";
import { DEBUGGING_ON, config } from "./config";

export async function setupRendering() {
  const [glb, hdri] = await Promise.all(
    ["/assets/helmet-flipped.glb", "/assets/venice_sunset_1k.hdr"].map((url) =>
      fetch(url).then((response) => response.arrayBuffer()),
    ),
  );
  logTime("Downloaded GLB.");

  const gltf = readGlb(glb);
  if (DEBUGGING_ON) {
    console.log(gltf);
  }

  const canvas = document.getElementById("canvas") as HTMLCanvasElement;

  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = width * window.devicePixelRatio;
  canvas.height = height * window.devicePixelRatio;
  canvas.style.setProperty("width", `${width}px`);
  canvas.style.setProperty("height", `${height}px`);

  logTime("Created canvas.");

  const context = canvas.getContext("webgpu");
  invariant(context, "WebGPU is not supported in this browser.");

  const entry = navigator.gpu;
  invariant(entry, "WebGPU is not supported in this browser.");

  const adapter = await entry.requestAdapter({
    // powerPreference: "high-performance",
  });
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
    cubemapTexture,
    irradianceMap,
    prefilterMap,
    brdfLookup,
    config.sampleCount,
    config.shadowMapSize,
  );

  function render() {
    renderer.render();
    requestAnimationFrame(render);
  }

  render();

  if (DEBUGGING_ON) {
    console.log(renderer);
  }
}
