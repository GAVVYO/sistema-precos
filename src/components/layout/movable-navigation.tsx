"use client";

import { GripVertical } from "lucide-react";
import { CSSProperties, ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button, cx } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { Dialog } from "@/components/ui/dialog";
import { useReducedMotion } from "@/components/ui/use-reduced-motion";

type Position = { x: number; y: number; vertical: boolean };
const subscribe = (cb: () => void) => { window.addEventListener("gavyo-navigation", cb); window.addEventListener("storage", cb); window.addEventListener("resize", cb); return () => { window.removeEventListener("gavyo-navigation", cb); window.removeEventListener("storage", cb); window.removeEventListener("resize", cb); }; };

export function MovableNavigation({ children, preferenceKey, onDockSide }: { children: ReactNode; preferenceKey: string; /** Fixar como barra lateral (só em telas largas). */ onDockSide?: () => void }) {
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
  const [nearSide, setNearSide] = useState(false);
  const inSideZone = (x: number) => !!onDockSide && x <= 96;
  const [options, setOptions] = useState(false);
  const reducedMotion = useReducedMotion();
  const ignoreClick = useRef(false);
  const gesture = useRef<{ pointerId: number; x: number; y: number; left: number; top: number; moved: boolean; vertical: boolean } | null>(null);
  useEffect(() => {
    const cancel = () => { gesture.current = null; setDraft(undefined); setNearTop(false); setNearSide(false); };
    window.addEventListener("blur", cancel);
    return () => window.removeEventListener("blur", cancel);
  }, []);
  const save = (p: Position | null) => { try { if (p) localStorage.setItem(key, JSON.stringify(p)); else localStorage.removeItem(key); window.dispatchEvent(new Event("gavyo-navigation")); } catch { toast("error", "Não foi possível guardar a posição da barra."); } setDraft(undefined); };
  const clamp = (p: Position): Position => ({ ...p, x: Math.max(8, Math.min(p.x, width - Math.min(p.vertical ? 232 : 920, width - 16) - 8)), y: Math.max(8, Math.min(p.y, height - Math.min(p.vertical ? 480 : 96, height - 16) - 8)) });
  const inTopZone = (y: number) => y <= (home.current?.getBoundingClientRect().top ?? 100) + 64;
  const dock = () => {
    const before = frame.current?.getBoundingClientRect();
    save(null); setNearTop(false);
    requestAnimationFrame(() => {
      const element = frame.current;
      if (!element || !before || reducedMotion) return;
      const after = element.getBoundingClientRect();
      element.animate([{ transformOrigin: "top left", transform: `translate(${before.left - after.left}px, ${before.top - after.top}px) scale(${before.width / after.width}, ${before.height / after.height})`, opacity: .8 }, { transformOrigin: "top left", transform: "none", opacity: 1 }], { duration: 220, easing: "cubic-bezier(.16,1,.3,1)" });
    });
  };
  const style = position ? { left: clamp(position).x, top: clamp(position).y } as CSSProperties : undefined;
  const move = (x: number, y: number) => {
    const rect = frame.current?.getBoundingClientRect();
    const current = position ?? { x: rect?.left ?? 8, y: rect?.top ?? 120, vertical: true };
    save(clamp({ ...current, x: current.x + x, y: current.y + y }));
  };
  return <div ref={home} className="movable-nav-slot">
    {nearTop && <div className="nav-dock-target" role="status">Solte para encaixar no topo</div>}
    {nearSide && <div className="nav-side-target" role="status"><span>Solte para fixar na lateral</span></div>}
    <div ref={frame} style={style} className={cx("movable-nav-frame", position && "nav-floating", position?.vertical && "nav-vertical", draft && "nav-moving", position && clamp(position).y > height / 2 && "nav-menu-up")}>
      <button type="button" className="nav-move-handle" aria-label="Mover barra de navegação" aria-haspopup="dialog" title="Clique para posicionar a barra. Você também pode arrastar ou usar as setas; Home retorna ao topo." onClick={() => { if (ignoreClick.current) { ignoreClick.current = false; return; } setOptions(true); }} onPointerDown={e => {
        if (e.button !== 0 || gesture.current) return;
        ignoreClick.current = false;
        const rect = frame.current?.getBoundingClientRect(); if (!rect) return;
        gesture.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, left: rect.left, top: rect.top, moved: false, vertical: position?.vertical ?? true };
        e.currentTarget.setPointerCapture(e.pointerId);
      }} onPointerMove={e => {
        const g = gesture.current; if (!g || g.pointerId !== e.pointerId) return;
        const dx = e.clientX - g.x, dy = e.clientY - g.y;
        if (!g.moved && Math.hypot(dx, dy) < 6) return;
        g.moved = true;
        setNearTop(inTopZone(e.clientY));
        setNearSide(!inTopZone(e.clientY) && inSideZone(e.clientX));
        setDraft(clamp({ x: g.left + dx, y: g.top + dy, vertical: g.vertical }));
      }} onPointerUp={e => {
        const g = gesture.current; if (!g || g.pointerId !== e.pointerId) return;
        gesture.current = null;
        ignoreClick.current = g.moved;
        if (g?.moved) {
          if (inTopZone(e.clientY)) dock();
          else if (inSideZone(e.clientX)) { setDraft(undefined); setNearSide(false); onDockSide?.(); }
          else save(clamp({ x: g.left + e.clientX - g.x, y: g.top + e.clientY - g.y, vertical: g.vertical }));
        }
        setNearTop(false); setNearSide(false);
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      }} onLostPointerCapture={() => { gesture.current = null; setDraft(undefined); setNearTop(false); }} onPointerCancel={() => { gesture.current = null; setDraft(undefined); setNearTop(false); }} onKeyDown={e => {
        if (e.key === "Escape") { gesture.current = null; setDraft(undefined); setNearTop(false); return; }
        if (e.key === "Home") { e.preventDefault(); dock(); return; }
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
        e.preventDefault();
        move(e.key === "ArrowRight" ? 24 : e.key === "ArrowLeft" ? -24 : 0, e.key === "ArrowDown" ? 24 : e.key === "ArrowUp" ? -24 : 0);
      }}><GripVertical size={18} aria-hidden /></button>
      <div className="movable-nav-content">{children}</div>

    </div>
    {options && <Dialog title="Posicionar navegação" subtitle="Escolha uma posição sem precisar arrastar." size="sm" onClose={() => setOptions(false)} footer={<Button onClick={() => setOptions(false)}>Fechar</Button>}>
      <div className="grid gap-3">
        <Button onClick={() => { dock(); setOptions(false); }}>Encaixar no topo</Button>
        {onDockSide && <Button variant="primary" onClick={() => { setOptions(false); onDockSide(); }}>Fixar na lateral (empurra a página)</Button>}
        <Button onClick={() => { save(clamp({ x: 8, y: height / 3, vertical: true })); setOptions(false); }}>Flutuar à esquerda</Button>
        <Button onClick={() => { save(clamp({ x: width - 240, y: height / 3, vertical: true })); setOptions(false); }}>Flutuar à direita</Button>
      </div>
      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-semibold">Ajustar posição em passos</legend>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => move(0, -24)}>Mover para cima</Button>
          <Button onClick={() => move(0, 24)}>Mover para baixo</Button>
          <Button onClick={() => move(-24, 0)}>Mover à esquerda</Button>
          <Button onClick={() => move(24, 0)}>Mover à direita</Button>
        </div>
      </fieldset>
      <p className="mt-4 text-sm text-muted">Com a alça em foco, as setas movem a barra. Home restaura o topo.</p>
    </Dialog>}
  </div>;
}
