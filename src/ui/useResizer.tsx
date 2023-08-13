import { useEffect, useRef, useState } from "react";

export function useResizer() {
  const [width, setWidth] = useState(300);
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(0);
  const ref = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      startX.current = e.clientX;
      startWidth.current = width;
      isDragging.current = true;
    }

    function onPointerMove(e: PointerEvent) {
      if (!isDragging.current) {
        return;
      }

      const delta = e.clientX - startX.current;
      setWidth(startWidth.current - delta);
    }

    function onPointerUp() {
      isDragging.current = false;
      startX.current = 0;
      startWidth.current = 0;
    }

    ref.current?.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      ref.current?.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  return { ref, width };
}
