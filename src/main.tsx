import "./style.css";
import { setupRendering } from "./runGLTFRenderer";

export const DEBUGGING_ON = true;

import React, { useRef, useState } from "react";
import * as Select from "./ui/Select";
import { createRoot } from "react-dom/client";
import { Input } from "./ui/Input";
import { Checkbox } from "./ui/Checkbox";
import * as RadioGroup from "./ui/RadioGroup";
import { Widget } from "./ui/Widget";
import { Label } from "./ui/Label";
import * as Accordion from "@radix-ui/react-accordion";

type ToneMapping = "reinhard" | "uncharted2" | "aces" | "lottes";

function App() {
  const [toneMapping, setToneMapping] = useState<ToneMapping>("lottes");
  const [environment, setEnvironment] = useState<string>("goegap_1k");

  const ref = useRef<HTMLCanvasElement>(null);

  // useEffect(() => {
  //   if (!ref.current) {
  //     return;
  //   }

  //   if (renderer.state === "ready") {
  //     renderer.destroy();
  //   }

  //   renderer
  //     .init(ref.current, environmentToFile[environment], toneMapping)
  //     .then(() => {
  //       renderer.render();
  //     });

  //   return () => {
  //     renderer.destroy();
  //   };
  // }, [environment, toneMapping]);

  if (!DEBUGGING_ON) {
    return null;
  }

  return (
    <>
      {/* <canvas
        ref={ref}
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
        }}
        width={window.innerWidth}
        height={window.innerHeight}
      /> */}
      <Accordion.Root
        type="multiple"
        defaultValue={["scene", "node", "material", "debug"]}
        className="absolute bottom-0 right-0 flex h-full w-[300px] select-none flex-col gap-0.5 bg-slatedark1 p-0.5"
      >
        <Widget value="configuration" title="Configuration">
          <Label>Irradiance map size</Label>
          <Input value="32" />
          <Label>Prefilter map size</Label>
          <Input value="256" />
          <Label>BRDF LUT size</Label>
          <Input value="512" />
          <Label>Sample count</Label>
          <Input value="4" />
          <Label>Shadow map size</Label>
          <Input value="4096" />
        </Widget>
        <Widget value="scene" title="Scene">
          <Label>Format</Label>
          <RadioGroup.Root defaultValue="one">
            <RadioGroup.Item value="one">sRGB</RadioGroup.Item>
            <RadioGroup.Item value="two">float16</RadioGroup.Item>
            <RadioGroup.Item value="three">BGRA</RadioGroup.Item>
          </RadioGroup.Root>
          <Label>Value</Label>
          <Input placeholder="Test" />
          <Label>Tone mapping</Label>
          <Select.Root
            value={toneMapping}
            onValueChange={(value: ToneMapping) => setToneMapping(value)}
          >
            <Select.Trigger>
              <Select.Value placeholder="Tone mapping" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="reinhard">Reinhard</Select.Item>
              <Select.Item value="uncharted2">Uncharted2</Select.Item>
              <Select.Item value="aces">Aces</Select.Item>
              <Select.Item value="lottes">Lottes</Select.Item>
            </Select.Content>
          </Select.Root>
          <Label>HDRI map</Label>
          <Select.Root
            value={environment}
            onValueChange={(value: Environment) => setEnvironment(value)}
          >
            <Select.Trigger>
              <Select.Value placeholder="Theme" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="dikhololo_night_1k">
                Dikhololo night 1K
              </Select.Item>
              <Select.Item value="goegap_1k">Goegap 1K</Select.Item>
              <Select.Item value="lebombo_1k">Lebombo 1K</Select.Item>
              <Select.Item value="snowy_park_01_1k">Snowy park 1K</Select.Item>
            </Select.Content>
          </Select.Root>
        </Widget>
        <Widget value="node" title="Node">
          <Label>Location</Label>
          <div className="flex items-center gap-1">
            <Label>X</Label>
            <Input value="0.0" />
            <Label>Y</Label>
            <Input value="0.0" />
            <Label>Z</Label>
            <Input value="0.0" />
          </div>
          <Label>Rotation</Label>
          <div className="flex items-center gap-1">
            <Label>X</Label>
            <Input value="0.0" />
            <Label>Y</Label>
            <Input value="0.0" />
            <Label>Z</Label>
            <Input value="0.0" />
          </div>
          <Label>Scale</Label>
          <div className="flex items-center gap-1">
            <Label>X</Label>
            <Input value="0.0" />
            <Label>Y</Label>
            <Input value="0.0" />
            <Label>Z</Label>
            <Input value="0.0" />
          </div>
          <Label>Cast shadow</Label>
          <Checkbox value="on" />
        </Widget>
        <Widget value="material" title="Material">
          <Label>Albedo</Label>
          <div className="h-6 w-14 rounded-[4px] bg-indigo-300" />
          <Label>Normal</Label>
          <div className="h-6 w-14 rounded-[4px] bg-indigo-300" />
          <Label>Roughness/Metallic</Label>
          <div className="h-6 w-14 rounded-[4px] bg-indigo-300" />
          <Label>AO</Label>
          <div className="h-6 w-14 rounded-[4px] bg-indigo-300" />
          <Label>Emissive</Label>
          <div className="h-6 w-14 rounded-[4px] bg-indigo-300" />
        </Widget>
        <Widget value="debug" title="Debug">
          <Label>Render specific texture</Label>
          <Checkbox value="on" />
          <Label>Material texture</Label>
          <Select.Root value="roughnessMetallic">
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="albedo">Albedo</Select.Item>
              <Select.Item value="normal">Normal</Select.Item>
              <Select.Item value="roughnessMetallic">
                Roughness/Metallic
              </Select.Item>
              <Select.Item value="ao">AO</Select.Item>
              <Select.Item value="emissive">Emissive</Select.Item>
            </Select.Content>
          </Select.Root>
        </Widget>
      </Accordion.Root>
    </>
  );
}

createRoot(document.getElementById("app")!).render(<App />);

const gpuResourceStats = {
  pipelineCount: 0,
  bindGroupCount: 0,
  pipelineSets: 0,
  bindGroupSets: 0,
  bufferSets: 0,
  drawCount: 0,
  instanceCount: 0,
};

if (DEBUGGING_ON && "GPUDevice" in window) {
  const _createRenderPipeline = GPUDevice.prototype.createRenderPipeline;
  GPUDevice.prototype.createRenderPipeline = function (...args) {
    gpuResourceStats.pipelineCount += 1;
    return _createRenderPipeline.apply(this, args);
  };

  const _createBindGroup = GPUDevice.prototype.createBindGroup;
  GPUDevice.prototype.createBindGroup = function (...args) {
    gpuResourceStats.bindGroupCount += 1;
    return _createBindGroup.apply(this, args);
  };

  const _setPipeline = GPURenderPassEncoder.prototype.setPipeline;
  GPURenderPassEncoder.prototype.setPipeline = function (...args) {
    gpuResourceStats.pipelineSets += 1;
    return _setPipeline.apply(this, args);
  };

  const _setBindGroup = GPURenderPassEncoder.prototype.setBindGroup;
  // @ts-ignore
  GPURenderPassEncoder.prototype.setBindGroup = function (...args) {
    gpuResourceStats.bindGroupSets += 1;
    // @ts-ignore
    return _setBindGroup.apply(this, args);
  };

  const _setVertexBuffer = GPURenderPassEncoder.prototype.setVertexBuffer;
  GPURenderPassEncoder.prototype.setVertexBuffer = function (...args) {
    gpuResourceStats.bufferSets += 1;
    return _setVertexBuffer.apply(this, args);
  };

  const _setIndexBuffer = GPURenderPassEncoder.prototype.setIndexBuffer;
  GPURenderPassEncoder.prototype.setIndexBuffer = function (...args) {
    gpuResourceStats.bufferSets += 1;
    return _setIndexBuffer.apply(this, args);
  };

  const _drawIndexed = GPURenderPassEncoder.prototype.drawIndexed;
  GPURenderPassEncoder.prototype.drawIndexed = function (...args) {
    gpuResourceStats.drawCount += 1;
    gpuResourceStats.instanceCount += args[1] || 1;
    return _drawIndexed.apply(this, args);
  };
}

setupRendering().then(() => {
  if (!DEBUGGING_ON) {
    return;
  }

  let message = "GPU resource stats:\n";
  for (const [key, value] of Object.entries(gpuResourceStats)) {
    message += `${key}: ${value}\n`;
  }

  console.log(message);
});
