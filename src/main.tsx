import "./style.css";
import { setupRendering } from "./runGLTFRenderer";

export const DEBUGGING_ON = true;

import React, { useState, useSyncExternalStore } from "react";
import * as Select from "./ui/Select";
import { createRoot } from "react-dom/client";
import { Input } from "./ui/Input";
import { Checkbox } from "./ui/Checkbox";
import * as RadioGroup from "./ui/RadioGroup";
import { Widget } from "./ui/Widget";
import { Label } from "./ui/Label";
import * as Accordion from "@radix-ui/react-accordion";
import { Popover } from "./ui/Popover";
import { Tabs } from "./ui/Tabs";
import { ColorPicker } from "./ui/ColorPicker";
import { Store } from "./ui/Store";
import { useResizer } from "./ui/useResizer";
import { List } from "./ui/List";

type ToneMapping = "reinhard" | "uncharted2" | "aces" | "lottes";

const store = new Store();

function App() {
  const [toneMapping, setToneMapping] = useState<ToneMapping>("lottes");
  const [environment, setEnvironment] = useState<string>("goegap_1k");

  if (!DEBUGGING_ON) {
    return null;
  }

  const a = useSyncExternalStore(store.subscribe, store.getSnapshot);

  const { ref, width } = useResizer();

  return (
    <div className="flex h-screen">
      <canvas
        className="flex"
        id="canvas"
        style={{
          width: `calc(100% - ${width}px)`,
        }}
      />
      <Accordion.Root
        type="multiple"
        defaultValue={["list2", "scene", "node", "material", "debug"]}
        className="relative flex select-none flex-col gap-0.5 overflow-y-scroll p-0.5"
        style={{ width }}
      >
        <div
          ref={ref}
          className="absolute h-full w-2 -translate-x-1 cursor-col-resize"
        ></div>
        <Widget value="list2" title="List 2" className="p-0">
          <List />
        </Widget>
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
          <Label htmlFor="format">Format</Label>
          <RadioGroup.Root defaultValue="one" id="format">
            <RadioGroup.Item value="one">sRGB</RadioGroup.Item>
            <RadioGroup.Item value="two">float16</RadioGroup.Item>
            <RadioGroup.Item value="three">BGRA</RadioGroup.Item>
          </RadioGroup.Root>
          <Label htmlFor="value">Value</Label>
          <Input placeholder="Test" id="value" />
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
            onValueChange={(value: string) => setEnvironment(value)}
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
        <Widget value="node" title="Node (id: 2)">
          <Label>Location</Label>
          <div className="flex items-center gap-1">
            <Label htmlFor="location-x">X</Label>
            <Input id="location-x" value="0.0" />
            <Label htmlFor="location-y">Y</Label>
            <Input id="location-y" value="0.0" />
            <Label htmlFor="location-z">Z</Label>
            <Input id="location-z" value="0.0" />
          </div>
          <Label>Rotation</Label>
          <div className="flex items-center gap-1">
            <Label htmlFor="rotation-x">X</Label>
            <Input id="rotation-x" value="0.0" />
            <Label htmlFor="rotation-y">Y</Label>
            <Input id="rotation-y" value="0.0" />
            <Label htmlFor="rotation-z">Z</Label>
            <Input id="rotation-z" value="0.0" />
          </div>
          <Label>Scale</Label>
          <div className="flex items-center gap-1">
            <Label htmlFor="scale-x">X</Label>
            <Input id="scale-x" value="0.0" />
            <Label htmlFor="scale-y">Y</Label>
            <Input id="scale-y" value="0.0" />
            <Label htmlFor="scale-z">Z</Label>
            <Input id="scale-z" value="0.0" />
          </div>
          <Label htmlFor="cast-shadow">Cast shadow</Label>
          <Checkbox value="on" id="cast-shadow" />
        </Widget>
        <Widget value="material" title='Material "Gold"'>
          <Label>Albedo</Label>
          <Color />
          <Label>Normal</Label>
          <Color />
          <Label>Roughness/Metallic</Label>
          <Color />
          <Label>AO</Label>
          <Color />
          <Label>Emissive</Label>
          <Color />
        </Widget>
        <Widget value="debug" title="Debug">
          <Label htmlFor="specific">Render specific texture</Label>
          <Checkbox id="specific" value="on" />
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
    </div>
  );
}

function Color() {
  return (
    <Popover
      trigger={
        <button className="h-6 w-14 rounded bg-indigo-300 outline-none focus:outline-none focus:ring-1 focus:ring-bluedark8" />
      }
      className="w-[200px]"
      content={
        <Tabs
          tabs={[
            {
              title: "Color",
              content: <ColorPicker />,
            },
            { title: "Texture", content: <div className="h-[280px]" /> },
          ]}
        />
      }
    />
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

// setupRendering().then(() => {
//   // TODO: move things around so here I have access to gltf

//   if (!DEBUGGING_ON) {
//     return;
//   }

//   let message = "GPU resource stats:\n";
//   for (const [key, value] of Object.entries(gpuResourceStats)) {
//     message += `${key}: ${value}\n`;
//   }

//   console.log(message);
// });
