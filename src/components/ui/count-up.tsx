"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./use-reduced-motion";

/**
 * Número que "rola" até o valor novo quando ele muda, como um placar
 * (referências: placares de aeroporto, contadores do Stripe/Linear).
 * Só anima em mudanças, nunca na primeira exibição. O leitor de tela recebe
 * apenas o valor final; com movimento reduzido o número troca direto.
 */
export function CountUp({ value, format = (n) => n.toLocaleString("pt-BR"), duration = 650, className }: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const [dir, setDir] = useState<"up" | "down" | null>(null);
  const from = useRef(value);

  useEffect(() => {
    if (value === from.current) return;
    const start = from.current;
    from.current = value;
    let frame = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(p >= 1 ? value : Math.round(start + (value - start) * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame((now) => { setDir(value > start ? "up" : "down"); tick(now); });
    const clear = window.setTimeout(() => setDir(null), duration + 500);
    return () => { cancelAnimationFrame(frame); window.clearTimeout(clear); };
  }, [value, duration]);

  const display = reduced ? value : shown;
  return (
    <span className={`count-up ${className ?? ""}`} data-dir={reduced ? undefined : dir ?? undefined}>
      <span aria-hidden>{format(display)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
