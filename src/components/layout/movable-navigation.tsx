"use client";

import { GripVertical } from "lucide-react";
import { CSSProperties, ReactNode, useRef, useState, useSyncExternalStore } from "react";
import { cx } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";

type Position = { x: number; y: number; vertical: boolean };
const subscribe = (cb: () => void) => { window.addEventListener("gavyo-navigation", cb); window.addEventListener("storage", cb); window.addEventListener("resize", cb); return () => { window.removeEventListener("gavyo-navigation", cb); window.removeEventListener("storage", cb); window.removeEventListener("resize", cb); }; };

export function MovableNavigation({ children, preferenceKey }: { children: ReactNode; preferenceKey: string }) {
  const key = `gavyo:navigation-position:v1:${preferenceKey}`;
  const raw = useSyncExternalStore(subscribe, () => { try { return localStorage.getItem(key) ?? ""; } catch { return ""; } }, () => "");
  const size = useSyncExternalStore(subscribe, () => `${innerWidth}:${innerHeight}`, () => "1366:768");
  const [width, height] = size.split(":").map(Number);
  let saved: Position | null = null;
  try { const p = JSON.parse(raw); if (p && Number.isFinite(p.x) && Number.isFinite(p.y) && typeof p.vertical === "boolean") saved = p; } catch { /* Posição inicial. */ }
  const [draft, setDraft] = useState<Position | undefined>();
  const position = draft ?? saved;
  const frame = useRef<HTMLDivElement>(null);
  const home = useRef<HTMLDivElement>(null);
  const [nearTop, setNearTop] = useState(false);
  const gesture = useRef<{ x: number; y: number; left: number; top: number; moved: boolean; vertical: boolean } | null>(null);
  const save = (p: Position | null) => { try { if (p) localStorage.setItem(key, JSON.stringify(p)); else localStorage.removeItem(key); window.dispatchEvent(new Event("gavyo-navigation")); } catch { toast("error", "Não foi possível guardar a posição da barra."); } setDraft(undefined); };
  const clamp = (p: Position): Position => ({ ...p, x: Math.max(8, Math.min(p.x, width - Math.min(p.vertical ? 232 : 920, width - 16) - 8)), y: Math.max(8, Math.min(p.y, height - Math.min(p.vertical ? 480 : 96, height - 16) - 8)) });
  const inTopZone = (y: number) => y <= (home.current?.getBoundingClientRect().top ?? 100) + 64;
  const dock = () => {
    const before = frame.current?.getBoundingClientRect();
    save(null); setNearTop(false);
    requestAnimationFrame(() => {
      const element = frame.current;
      if (!element || !before || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const after = element.getBoundingClientRect();
      element.animate([{ transformOrigin: "top left", transform: `translate(${before.left - after.left}px, ${before.top - after.top}px) scale(${before.width / after.width}, ${before.height / after.height})`, opacity: .8 }, { transformOrigin: "top left", transform: "none", opacity: 1 }], { duration: 220, easing: "cubic-bezier(.16,1,.3,1)" });
    });
  };
  const style = position ? { left: clamp(position).x, top: clamp(position).y } as CSSProperties : undefined;
  return <div ref={home} className="movable-nav-slot">
    {nearTop && <div className="nav-dock-target" role="status">Solte para encaixar no topo</div>}
    <div ref={frame} style={style} className={cx("movable-nav-frame", position && "nav-floating", position?.vertical && "nav-vertical", draft && "nav-moving", position && clamp(position).y > height / 2 && "nav-menu-up")}>
      <button type="button" className="nav-move-handle" aria-label="Mover barra de navegação" title="Arraste a barra em qualquer direção. Use as setas pelo teclado." onPointerDown={e => {
        if (e.button !== 0) return;
        const rect = frame.current?.getBoundingClientRect(); if (!rect) return;
        gesture.current = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top, moved: false, vertical: position?.vertical ?? true };
        e.currentTarget.setPointerCapture(e.pointerId);
      }} onPointerMove={e => {
        const g = gesture.current; if (!g) return;
        const dx = e.clientX - g.x, dy = e.clientY - g.y;
        if (!g.moved && Math.hypot(dx, dy) < 6) return;
        g.moved = true;
        setNearTop(inTopZone(e.clientY));
        setDraft(clamp({ x: g.left + dx, y: g.top + dy, vertical: g.vertical }));
      }} onPointerUp={e => {
        const g = gesture.current; gesture.current = null;
        if (g?.moved) {
          if (inTopZone(e.clientY)) dock();
          else save(clamp({ x: g.left + e.clientX - g.x, y: g.top + e.clientY - g.y, vertical: g.vertical }));
        }
        setNearTop(false);
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      }} onPointerCancel={() => { gesture.current = null; setDraft(undefined); setNearTop(false); }} onDoubleClick={dock} onKeyDown={e => {
        if (e.key === "Escape") { gesture.current = null; setDraft(undefined); setNearTop(false); return; }
        if (e.key === "Home") { e.preventDefault(); dock(); return; }
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
        e.preventDefault(); const rect = frame.current?.getBoundingClientRect();
        const p = position ?? { x: rect?.left ?? 8, y: rect?.top ?? 120, vertical: true };
        save(clamp({ ...p, x: p.x + (e.key === "ArrowRight" ? 24 : e.key === "ArrowLeft" ? -24 : 0), y: p.y + (e.key === "ArrowDown" ? 24 : e.key === "ArrowUp" ? -24 : 0) }));
      }}><GripVertical size={18} aria-hidden /></button>
      <div className="movable-nav-content">{children}</div>

    </div>
  </div>;
}
