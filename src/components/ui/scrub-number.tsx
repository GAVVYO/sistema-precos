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
  inputScale = 1,
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
  /** Divisor para digitar (ex.: 100 quando o valor está em centavos e a pessoa digita reais). */
  inputScale?: number;
}) {
  const [preview, setPreview] = useState<number | null>(null);
  const start = useRef<{ x: number; v: number; moved: boolean } | null>(null);
  // Clique sem arrastar abre um campo para digitar: alternativa ao arrasto (WCAG 2.5.7).
  const [typing, setTyping] = useState<string | null>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const shown = preview ?? value;

  const commit = () => {
    if (preview !== null && preview !== value) onCommit(preview);
    setPreview(null);
    start.current = null;
  };

  const commitTyped = () => {
    if (typing === null) return;
    const parsed = Number(typing.replace(/\./g, "").replace(",", "."));
    setTyping(null);
    if (typing.trim() === "" || !Number.isFinite(parsed)) return;
    const next = clamp(Math.round(parsed * inputScale));
    if (next !== value) onCommit(next);
  };

  if (typing !== null) {
    return (
      <input
        className={cx("scrub scrub-input", className)}
        aria-label={label}
        inputMode="decimal"
        autoFocus
        value={typing}
        onChange={(e) => setTyping(e.target.value)}
        onBlur={commitTyped}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commitTyped(); }
          if (e.key === "Escape") { e.stopPropagation(); setTyping(null); }
        }}
      />
    );
  }

  const openTyping = () => setTyping(inputScale === 1 ? String(value) : (value / inputScale).toFixed(2).replace(".", ","));

  return (
    <span
      role="spinbutton"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuenow={shown}
      aria-valuetext={format(shown)}
      aria-valuemin={min}
      aria-disabled={disabled || undefined}
      title={disabled ? undefined : "Clique para digitar, ou arraste para os lados para ajustar (Shift: passo maior)"}
      className={cx("scrub", preview !== null && "is-scrubbing", disabled && "is-disabled", className)}
      onPointerDown={(e) => {
        if (disabled || e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, v: value, moved: false };
        setPreview(value);
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        const steps = Math.round((e.clientX - start.current.x) / pxPerStep);
        if (steps !== 0) start.current.moved = true;
        setPreview(clamp(start.current.v + steps * (e.shiftKey ? bigStep : step)));
      }}
      onPointerUp={() => {
        if (start.current && !start.current.moved) { setPreview(null); start.current = null; if (!disabled) openTyping(); return; }
        commit();
      }}
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
          if (preview === null) openTyping();
          else commit();
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
