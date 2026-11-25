"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./use-reduced-motion";

/** Passo do contador: texto aos `elapsed` ms, com saída cúbica, até `end`. */
export function countFrames(start: number, end: number, duration: number, format: (n: number) => string): (elapsed: number) => { text: string; done: boolean } {
  return (elapsed) => {
    const p = Math.min(1, Math.max(0, elapsed / duration));
    if (p >= 1) return { text: format(end), done: true };
    const eased = 1 - Math.pow(1 - p, 3);
    return { text: format(Math.round(start + (end - start) * eased)), done: false };
  };
}

/** Troca o texto no mesmo nó que o React criou (assim ele continua no controle do elemento). */
function writeText(el: HTMLElement, text: string) {
  const node = el.firstChild;
  if (node && node.nodeType === Node.TEXT_NODE) node.nodeValue = text;
  else el.textContent = text;
}

/**
 * Número que "rola" até o valor novo quando ele muda, como um placar
 * (referências: placares de aeroporto, contadores do Stripe/Linear).
 * Só anima em mudanças, nunca na primeira exibição. O leitor de tela recebe
 * apenas o valor final; com movimento reduzido o número troca direto.
 * Os quadros escrevem o texto direto no elemento: o React só redesenha no
 * começo e no fim (antes eram ~40 redesenhos por número).
 */
export function CountUp({ value, format = (n) => n.toLocaleString("pt-BR"), duration = 650, className }: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [dir, setDir] = useState<"up" | "down" | null>(null);
  const from = useRef(value);
  const shown = useRef<HTMLSpanElement>(null);
  // `format` costuma ser uma função nova a cada render: guardada aqui para não reiniciar a contagem.
  const formatRef = useRef(format);
  useEffect(() => { formatRef.current = format; });

  useEffect(() => {
    if (value === from.current) return;
    const start = from.current;
    from.current = value;
    const el = shown.current;
    if (reduced || !el) return;
    const step = countFrames(start, value, duration, (n) => formatRef.current(n));
    let frame = 0;
    let t0 = 0;
    const tick = (now: number) => {
      if (!t0) t0 = now;
      const { text, done } = step(now - t0);
      writeText(el, text);
      if (!done) frame = requestAnimationFrame(tick);
    };
    writeText(el, step(0).text);
    frame = requestAnimationFrame((now) => { setDir(value > start ? "up" : "down"); tick(now); });
    const clear = window.setTimeout(() => setDir(null), duration + 500);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(clear);
      writeText(el, formatRef.current(value));
    };
  }, [value, duration, reduced]);

  return (
    <span className={`count-up ${className ?? ""}`} data-dir={reduced ? undefined : dir ?? undefined}>
      <span ref={shown} aria-hidden>{format(value)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
