import React, { useEffect, useRef, useState } from "react";

const SIZE = 192;

type ColorPickerProps = {
  value: string;
};

export function ColorPicker() {
  const ref = useRef<HTMLDivElement>(null);
  const [point, setPoint] = useState({ saturation: 0, value: 0, hue: 0 });

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    function pointerDown(e: PointerEvent) {
      console.log(e.offsetX / SIZE, e.offsetY / SIZE);
      setPoint((point) => ({
        ...point,
        saturation: e.offsetX / SIZE,
        value: e.offsetY / SIZE,
      }));
    }

    ref.current.addEventListener("pointerdown", pointerDown);

    return () => {
      if (!ref.current) {
        return;
      }

      ref.current.removeEventListener("pointerdown", pointerDown);
    };
  }, []);

  const h = (point.hue * 360).toFixed(2);
  const s = (point.saturation * 100).toFixed(2);
  const v = (point.value * 100).toFixed(2);

  const color = `hsb(${h}, ${s}%, ${v}%)`;

  console.log(color);

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="relative" ref={ref} style={{ width: SIZE, height: SIZE }}>
        <div className="absolute h-full w-full rounded-[4px] bg-gradient-to-r from-white to-[#ff00ff]" />
        <div className="absolute h-full w-full rounded-[4px] bg-gradient-to-b from-transparent to-black" />
        <div
          className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{
            left: point.saturation * SIZE,
            top: point.value * SIZE,
            background: color,
          }}
        />
      </div>
      <div
        className="relative h-4 rounded-[4px]"
        style={{
          width: SIZE,
          background:
            "linear-gradient(90deg, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)",
        }}
      >
        <div
          className="absolute h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white shadow"
          style={{ left: point.hue * SIZE, background: color }}
        />
      </div>
    </div>
  );
}
