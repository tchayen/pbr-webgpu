import React, { useEffect, useRef, useState } from "react";
import { Input } from "./Input";
import { Label } from "./Label";

const SIZE = 200;
const HUE_SIZE = 168;

export function ColorPicker() {
  const colorAreaRef = useRef<HTMLDivElement>(null);
  const colorThumbRef = useRef<HTMLDivElement>(null);
  const hueSliderRef = useRef<HTMLDivElement>(null);
  const hueThumbRef = useRef<HTMLDivElement>(null);

  const [point, setPoint] = useState({ saturation: 0, value: 1, hue: 0 });
  const isDraggingColor = useRef(false);
  const isDraggingHue = useRef(false);

  const [text, setText] = useState("#FF0000");

  useEffect(() => {
    function pointerDownColor(e: PointerEvent) {
      if (e.target === colorThumbRef.current) {
        isDraggingColor.current = true;
      }

      pointerMoveColor(e);
    }

    function pointerMoveColor(e: PointerEvent) {
      if (!isDraggingColor.current || !colorAreaRef.current) {
        return;
      }

      const rectangle = colorAreaRef.current.getBoundingClientRect();
      const saturation = Math.min(
        Math.max((e.clientX - rectangle.left) / SIZE, 0),
        1,
      );
      const value =
        1 - Math.min(Math.max((e.clientY - rectangle.top) / SIZE, 0), 1);

      setPoint((p) => {
        setText(rgbToHex(hsvToRgb(p.hue * 360, saturation, value)));
        return { ...p, saturation, value };
      });
    }

    function pointerUpColor() {
      isDraggingColor.current = false;
    }

    function pointerDownHue(e: PointerEvent) {
      if (e.target === hueThumbRef.current) {
        isDraggingHue.current = true;
      }
      pointerMoveHue(e);
    }

    function pointerMoveHue(e: PointerEvent) {
      if (!isDraggingHue.current || !hueSliderRef.current) {
        return;
      }

      const rectangle = hueSliderRef.current.getBoundingClientRect();
      const hue = Math.min(
        Math.max((e.clientX - rectangle.left) / HUE_SIZE, 0),
        1,
      );
      setPoint((p) => {
        setText(rgbToHex(hsvToRgb(hue * 360, p.saturation, p.value)));
        return { ...p, hue };
      });
    }

    function pointerUpHue() {
      isDraggingHue.current = false;
    }

    colorAreaRef.current?.addEventListener("pointerdown", pointerDownColor);
    colorAreaRef.current?.addEventListener("pointermove", pointerMoveColor);
    window.addEventListener("pointerup", pointerUpColor);

    hueSliderRef.current?.addEventListener("pointerdown", pointerDownHue);
    hueSliderRef.current?.addEventListener("pointermove", pointerMoveHue);
    window.addEventListener("pointerup", pointerUpHue);

    return () => {
      colorAreaRef.current?.removeEventListener(
        "pointerdown",
        pointerDownColor,
      );
      colorAreaRef.current?.removeEventListener(
        "pointermove",
        pointerMoveColor,
      );
      window.removeEventListener("pointerup", pointerUpColor);

      hueSliderRef.current?.removeEventListener("pointerdown", pointerDownHue);
      hueSliderRef.current?.removeEventListener("pointermove", pointerMoveHue);
      window.removeEventListener("pointerup", pointerUpHue);
    };
  }, []);

  const rgbColor = hsvToRgb(point.hue * 360, point.saturation, point.value);
  const cssColor = rgbToHex(rgbColor);

  const hueColor = rgbToHex(hsvToRgb(point.hue * 360, 1, 1));

  const areaPicker = (
    <div
      className="relative"
      ref={colorAreaRef}
      style={{ width: SIZE, height: SIZE }}
    >
      <div
        className="absolute h-full w-full"
        style={{
          background: `linear-gradient(90deg, #ffffff 0%, ${hueColor} 100%)`,
        }}
      />
      <div className="absolute h-full w-full bg-gradient-to-b from-transparent to-black" />
      <div
        ref={colorThumbRef}
        className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
        style={{
          left: point.saturation * SIZE,
          top: SIZE * (1 - point.value),
          background: cssColor,
        }}
      />
    </div>
  );

  const hueSlider = (
    <div
      className="rounded-lg bg-[#ff0000] px-2"
      style={{
        width: HUE_SIZE + 16,
      }}
    >
      <div
        className="relative h-4"
        ref={hueSliderRef}
        style={{
          width: HUE_SIZE,
          background:
            "linear-gradient(90deg, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)",
        }}
      >
        <div
          ref={hueThumbRef}
          className="absolute h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white shadow"
          style={{ left: point.hue * HUE_SIZE, background: hueColor }}
        />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col pt-2">
      {areaPicker}
      <div className="p-2">{hueSlider}</div>
      <div className="flex items-center justify-between gap-[52px] p-2">
        <Label>Color</Label>
        <div className="flex items-center rounded-[4px] bg-slatedark1">
          <button
            onClick={() => {
              navigator.clipboard.writeText(text);
            }}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] bg-slatedark1 outline-none hover:bg-slatedark3 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-bluedark8 active:bg-slatedark4"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g clipPath="url(#clip0_53_678)">
                <path
                  d="M5.78124 0.00037384C4.65941 0.00037384 3.99999 0.659799 3.99999 1.78162V12.2191C3.99999 13.3409 4.65941 14.0004 5.78124 14.0004L12.2188 13.9998C13.3406 13.9998 14 13.3404 14 12.2186V1.78106C14 0.659232 13.3406 -0.00018692 12.2188 -0.00018692L5.78124 0.00037384ZM4.99999 1.78162C4.99999 1.35015 5.34974 1.00037 5.78124 1.00037L12.2188 0.999813C12.6503 0.999813 13 1.34959 13 1.78106V12.2186C13 12.6501 12.6503 12.9998 12.2188 12.9998L5.78124 13.0004C5.34974 13.0004 4.99999 12.6506 4.99999 12.2191V1.78162ZM3 2.00037C2.26595 2.30649 2 3.03097 2 3.87595V12.5004C2 14.7441 3.25634 16.0002 5.5 16.0002L10.1243 15.9998C10.9694 15.9998 11.6939 15.734 12 14.9998H10.1422C10.1363 14.9999 10.1303 15 10.1243 15L5.5 15.0004C3.9467 15.0004 3 14.0537 3 12.5004V2.00037Z"
                  fill="#6B7176"
                />
              </g>
              <defs>
                <clipPath id="clip0_53_678">
                  <path
                    d="M0 4C0 1.79086 1.79086 0 4 0H12C14.2091 0 16 1.79086 16 4V12C16 14.2091 14.2091 16 12 16H4C1.79086 16 0 14.2091 0 12V4Z"
                    fill="white"
                  />
                </clipPath>
              </defs>
            </svg>
          </button>
          <Input
            value={text}
            style={{ fontFeatureSettings: '"tnum"' }}
            onChange={(event) => {
              setText(event.target.value);
              try {
                const [r, g, b] = parseColor(event.target.value).map((x) =>
                  Math.min(Math.max(x, 0), 1),
                );
                const [h, s, v] = rgbToHsv(r, g, b);
                setPoint({ hue: h / 360, saturation: s, value: v });
              } catch {}
            }}
          />
        </div>
      </div>
    </div>
  );
}

// https://stackoverflow.com/a/54014428

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const f = (n: number, k = (n + h / 60) % 6): number =>
    v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);

  return [f(5), f(3), f(1)];
}

function rgbToHsv(r: number, g: number, b: number) {
  let value = Math.max(r, g, b);
  let c = value - Math.min(r, g, b);
  let h =
    c &&
    (value == r ? (g - b) / c : value == g ? 2 + (b - r) / c : 4 + (r - g) / c);
  return [60 * (h < 0 ? h + 6 : h), value && c / value, value];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number, k = (n + h / 30) % 12): number =>
    l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);

  return [f(0), f(8), f(4)];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const red = Math.round(r * 255)
    .toString(16)
    .padStart(2, "0");
  const green = Math.round(g * 255)
    .toString(16)
    .padStart(2, "0");
  const blue = Math.round(b * 255)
    .toString(16)
    .padStart(2, "0");

  return `#${red}${green}${blue}`.toUpperCase();
}

/**
 * Supported formats:
 *
 * ### Hex
 * - `#f00`
 * - `#ff0000`
 *
 * ### RGB
 *
 * - `rgb(255, 0, 0)`
 * - `rgba(255, 0, 0, 0.5)`
 *
 * ### HSL
 *
 * - `hsl(60, 100%, 50%)`
 * - `hsl(60 100% 50%)`
 * - `hsla(30, 60%, 90%, 0.8)`
 * - `hsla(30 60% 90% 0.8)`
 * - `hsla(30 60% 90% / 0.8)`
 *
 * ### HSV
 *
 * See HSL.
 */
export function parseColor(color: string): [number, number, number, number] {
  if (color.startsWith("#")) {
    if (color.length === 7) {
      const r = parseInt(color.slice(1, 3), 16) / 255;
      const g = parseInt(color.slice(3, 5), 16) / 255;
      const b = parseInt(color.slice(5, 7), 16) / 255;

      return [r, g, b, 1];
    } else if (color.length === 4) {
      const r = parseInt(color.slice(1, 2), 16);
      const g = parseInt(color.slice(2, 3), 16);
      const b = parseInt(color.slice(3, 4), 16);

      return [r, g, b, 1];
    } else {
      throw new Error(`Unsupported color: ${color}.`);
    }
  } else if (color.startsWith("rgb")) {
    const hasAlpha = color[3] === "a";
    const channels = color
      .slice(hasAlpha ? 5 : 4, -1)
      .split(",")
      .map((s) => Number(s));

    return [
      channels[0] / 255,
      channels[1] / 255,
      channels[2] / 255,
      hasAlpha ? channels[3] : 1,
    ];
  } else if (color.startsWith("hsl")) {
    const separator = color.includes(",") ? "," : " ";
    const hasAlpha = color[3] === "a";
    const channels = color.slice(hasAlpha ? 5 : 4, -1).split(separator);

    if (color.includes("/")) {
      channels[3] = channels[4];
      channels.pop();
    }

    const alpha = hasAlpha ? Number(channels[3]) : 1;
    const converted = hslToRgb(
      Number(channels[0]),
      Number(channels[1].slice(0, -1)) / 100,
      Number(channels[2].slice(0, -1)) / 100,
    );

    return [converted[0], converted[1], converted[2], alpha];
  } else if (color.startsWith("hsv")) {
    const separator = color.includes(",") ? "," : " ";
    const hasAlpha = color[3] === "a";
    const channels = color.slice(hasAlpha ? 5 : 4, -1).split(separator);

    if (color.includes("/")) {
      channels[3] = channels[4];
      channels.pop();
    }

    const alpha = hasAlpha ? Number(channels[3]) : 1;
    const converted = hsvToRgb(
      Number(channels[0]),
      Number(channels[1].slice(0, -1)) / 100,
      Number(channels[2].slice(0, -1)) / 100,
    );

    return [converted[0], converted[1], converted[2], alpha];
  } else {
    throw new Error(`Unsupported color: ${color}.`);
  }
}
