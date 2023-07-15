import "./style.css";
import React, { useEffect, useRef, useState } from "react";
import { Renderer } from "./Renderer";
import * as Select from "./ui/Select";
import { createRoot } from "react-dom/client";

// const canvas = document.createElement("canvas");
// canvas.width = window.innerWidth * window.devicePixelRatio;
// canvas.height = window.innerHeight * window.devicePixelRatio;
// canvas.style.width = `${window.innerWidth}px`;
// canvas.style.height = `${window.innerHeight}px`;
// document.body.appendChild(canvas);

const renderer = new Renderer();

const environmentToFile = {
  dikhololo_night_1k: "/assets/dikhololo_night_1k.hdr",
  goegap_1k: "/assets/goegap_1k.hdr",
  lebombo_1k: "/assets/lebombo_1k.hdr",
  snowy_park_01_1k: "/assets/snowy_park_01_1k.hdr",
};

type ToneMapping = "reinhard" | "uncharted2" | "aces" | "lottes";
type Environment =
  | "dikhololo_night_1k"
  | "goegap_1k"
  | "lebombo_1k"
  | "snowy_park_01_1k";

function App() {
  const [toneMapping, setToneMapping] = useState<ToneMapping>("lottes");
  const [environment, setEnvironment] = useState<Environment>("goegap_1k");

  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    if (renderer.state === "ready") {
      renderer.destroy();
    }

    renderer
      .init(ref.current, environmentToFile[environment], toneMapping)
      .then(() => {
        renderer.render();
      });

    return () => {
      renderer.destroy();
    };
  }, [environment, toneMapping]);

  return (
    <>
      <canvas
        ref={ref}
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
        }}
        width={window.innerWidth}
        height={window.innerHeight}
      />
      <div className="absolute top-0 left-0">
        <div className="m-2 flex flex-col gap-4 rounded-md bg-slate3 p-4 shadow-sm">
          <div className="flex flex-col gap-1">
            <div className="text-xs text-slate10">Tone mapping</div>
            <Select.Root
              value={toneMapping}
              onValueChange={(value: ToneMapping) => setToneMapping(value)}
            >
              <Select.Trigger className="w-[180px]">
                <Select.Value placeholder="Tone mapping" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="reinhard">Reinhard</Select.Item>
                <Select.Item value="uncharted2">Uncharted2</Select.Item>
                <Select.Item value="aces">Aces</Select.Item>
                <Select.Item value="lottes">Lottes</Select.Item>
              </Select.Content>
            </Select.Root>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-xs text-slate10">Environment HDRI</div>
            <Select.Root
              value={environment}
              onValueChange={(value: Environment) => setEnvironment(value)}
            >
              <Select.Trigger className="w-[180px]">
                <Select.Value placeholder="Theme" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="dikhololo_night_1k">
                  Dikhololo night 1K
                </Select.Item>
                <Select.Item value="goegap_1k">Goegap 1K</Select.Item>
                <Select.Item value="lebombo_1k">Lebombo 1K</Select.Item>
                <Select.Item value="snowy_park_01_1k">
                  Snowy park 1K
                </Select.Item>
              </Select.Content>
            </Select.Root>
          </div>
        </div>
      </div>
    </>
  );
}

createRoot(document.getElementById("app")!).render(<App />);
