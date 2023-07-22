import { readGlb } from "./lib/readGlb";
import { invariant } from "./lib/invariant";
import { GLTFRenderer } from "./GLTFRenderer";

export async function setupRendering() {
  const glb = await fetch("/assets/scene3.glb").then((response) =>
    response.arrayBuffer()
  );

  const gltf = readGlb(glb);
  console.log(gltf);

  const canvas = document.createElement("canvas");
  canvas.width = window.innerWidth * window.devicePixelRatio;
  canvas.height = window.innerHeight * window.devicePixelRatio;
  canvas.style.setProperty("width", `${window.innerWidth}px`);
  canvas.style.setProperty("height", `${window.innerHeight}px`);
  document.body.appendChild(canvas);

  const context = canvas.getContext("webgpu");
  invariant(context, "WebGPU is not supported in this browser.");

  const entry = navigator.gpu;
  invariant(entry, "WebGPU is not supported in this browser.");

  const adapter = await entry.requestAdapter();
  invariant(adapter, "No GPU found on this system.");

  const device = await adapter.requestDevice();

  context.configure({
    device,
    format: navigator.gpu.getPreferredCanvasFormat(),
    alphaMode: "opaque",
  });

  const renderer = new GLTFRenderer(device, gltf, canvas, context);

  renderer.render();
}
