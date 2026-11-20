"use client";

import { RefObject, useLayoutEffect, useState } from "react";

/**
 * Pílula da aba ativa que desliza até a aba nova (referência: segmented controls
 * do iOS/macOS, abas do Arc). Mede o link com aria-current="page" dentro do
 * contêiner; na primeira medida não anima, para não "voar" ao abrir a página.
 */
export function NavPill({ container, watch }: { container: RefObject<HTMLElement | null>; watch: unknown }) {
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number; ready: boolean } | null>(null);

  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const measure = () => {
      const active = root.querySelector<HTMLElement>('[aria-current="page"]');
      if (!active) return setBox(null);
      const r = root.getBoundingClientRect();
      const a = active.getBoundingClientRect();
      const next = { x: a.left - r.left + root.scrollLeft, y: a.top - r.top + root.scrollTop, w: a.width, h: a.height };
      setBox((b) => (b && b.x === next.x && b.y === next.y && b.w === next.w && b.h === next.h ? b : { ...next, ready: !!b }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    root.querySelectorAll("a").forEach((a) => ro.observe(a));
    return () => ro.disconnect();
  }, [container, watch]);

  if (!box) return null;
  return (
    <span
      className="nav-pill"
      aria-hidden
      data-ready={box.ready || undefined}
      style={{ transform: `translate(${box.x}px, ${box.y}px)`, width: box.w, height: box.h }}
    />
  );
}
