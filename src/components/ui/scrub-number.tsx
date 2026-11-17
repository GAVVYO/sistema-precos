"use client";

import { MoveHorizontal } from "lucide-react";
import { useRef, useState } from "react";
import { cx } from "./primitives";

/**
 * Número ajustável arrastando para os lados (referência: Figma, Blender e
 * Photoshop). Shift usa o passo maior. Pelo teclado: ← → (ou ↑ ↓) ajustam e
 * Enter confirma; Esc cancela. Só grava ao soltar/confirmar, em uma única ação.
 */
export function ScrubNumber({
  value,
  onCommit,
  label,
  format,
  step = 1,
  bigStep = step * 10,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  pxPerStep = 10,
  disabled,
  className,
}: {
  value: number;
  onCommit: (next: number) => void;
  label: string;
  format: (v: number) => string;
  step?: number;
  bigStep?: number;
  min?: number;
  max?: number;
  pxPerStep?: number;
  disabled?: boolean;
  className?: string;
}) {
  const [preview, setPreview] = useState<number | null>(null);
  const start = useRef<{ x: number; v: number } | null>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const shown = preview ?? value;

  const commit = () => {
    if (preview !== null && preview !== value) onCommit(preview);
    setPreview(null);
    start.current = null;
  };

  return (
    <span
      role="spinbutton"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuenow={shown}
      aria-valuetext={format(shown)}
      aria-valuemin={min}
      aria-disabled={disabled || undefined}
      title={disabled ? undefined : "Arraste para os lados para ajustar (Shift: passo maior)"}
      className={cx("scrub", preview !== null && "is-scrubbing", disabled && "is-disabled", className)}
      onPointerDown={(e) => {
        if (disabled || e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, v: value };
        setPreview(value);
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        const steps = Math.round((e.clientX - start.current.x) / pxPerStep);
        setPreview(clamp(start.current.v + steps * (e.shiftKey ? bigStep : step)));
      }}
      onPointerUp={commit}
      onPointerCancel={() => { setPreview(null); start.current = null; }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (disabled) return;
        const dir = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
        if (dir) {
          e.preventDefault();
          e.stopPropagation();
          setPreview(clamp(shown + dir * (e.shiftKey ? bigStep : step)));
        } else if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape" && preview !== null) {
          e.stopPropagation();
          setPreview(null);
        }
      }}
    >
      {!disabled && <MoveHorizontal className="scrub-icon" aria-hidden />}
      <span className="tabular-nums">{format(shown)}</span>
    </span>
  );
}
