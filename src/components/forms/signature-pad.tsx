"use client";

import { useRef, useEffect, useCallback } from "react";
import SignaturePad from "signature_pad";
import { Eraser } from "lucide-react";

export function SignaturePadComponent({
  value,
  onChange,
  height = 120,
  className = "",
}: {
  value: string | null;
  onChange: (data: string | null) => void;
  height?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);

  const resizeCanvas = useCallback(() => {
    if (!canvasRef.current || !padRef.current) return;
    const canvas = canvasRef.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const data = padRef.current.toData();
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d")!.scale(ratio, ratio);
    padRef.current.clear();
    padRef.current.fromData(data);
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d")!.scale(ratio, ratio);

    const pad = new SignaturePad(canvas, {
      backgroundColor: "rgb(255, 255, 255)",
      penColor: "rgb(0, 0, 100)",
      minWidth: 1,
      maxWidth: 2.5,
    });

    pad.addEventListener("endStroke", () => {
      onChange(pad.toDataURL());
    });

    if (value) {
      pad.fromDataURL(value);
    }

    padRef.current = pad;

    window.addEventListener("resize", resizeCanvas);
    return () => {
      pad.off();
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  function clear() {
    padRef.current?.clear();
    onChange(null);
  }

  return (
    <div className={className}>
      <div className="border-2 border-dashed border-primary/30 rounded bg-white relative">
        <canvas
          ref={canvasRef}
          className="w-full touch-none cursor-crosshair"
          style={{ height }}
        />
        {!value && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-primary/30 text-sm">ここにサイン</span>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={clear}
        className="mt-1 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 print:hidden"
      >
        <Eraser className="h-3 w-3" />
        クリア
      </button>
    </div>
  );
}
