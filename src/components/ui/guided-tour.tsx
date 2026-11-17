"use client";

import { ArrowDown, ArrowUp, X } from "lucide-react";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "@/app-state/app-context";
import { usePref } from "@/lib/prefs";
import { Button } from "./primitives";
import { useReducedMotion } from "./use-reduced-motion";

export interface TourStep {
  /** Seletor CSS do elemento apontado; o primeiro visível é usado. Sem alvo, o passo é pulado. */
  target: string;
  title: string;
  body: ReactNode;
  /** Pequena animação que mostra o gesto ou o resultado. */
  illustration?: ReactNode;
}

type Box = { top: number; left: number; width: number; height: number };

const GAP = 52; // espaço entre o balão e o alvo, onde a seta animada pula
const PAD = 6; // folga do recorte em volta do alvo
const MARGIN = 12;

function findTarget(selector: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(selector)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/**
 * Tour guiado (coach marks): escurece a tela, recorta o elemento da vez e mostra
 * um balão com seta animada apontando para ele. Aparece só na primeira vez, por
 * usuário e oficina; "Pular" e Esc encerram. Respeita movimento reduzido.
 * Referências: Impeccable onboard, coach marks de apps móveis (Material, iOS Tips).
 */
export function GuidedTour({ id, steps, delay = 500 }: { id: string; steps: TourStep[]; delay?: number }) {
  const { user, membership } = useApp();
  const [seen, setSeen] = usePref<boolean>(`tip:${id}:${membership.workshopId}:${user.id}`, false);
  const [ready, setReady] = useState(false);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [popH, setPopH] = useState(200);
  /** Passo cujo alvo já terminou de rolar para a vista. */
  const [settled, setSettled] = useState(-1);
  const pop = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion();

  // Só os passos cujo alvo existe agora (ex.: Mecânico não vê "Receber").
  const [available, setAvailable] = useState<TourStep[]>([]);

  useEffect(() => {
    if (seen) return;
    const t = window.setTimeout(() => {
      const list = steps.filter((s) => findTarget(s.target));
      setAvailable(list);
      setReady(list.length > 0);
    }, delay);
    return () => window.clearTimeout(t);
    // Os passos são definidos uma vez por tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen, delay]);

  const step = available[index];
  const open = ready && !seen && !!step;

  // Leva o alvo para a vista e acompanha rolagem/redimensionamento.
  useEffect(() => {
    if (!open) return;
    const el = findTarget(step.target);
    // Só rola se o alvo não estiver bem à vista; o balão espera a rolagem terminar
    // para o recorte não "correr atrás" do botão.
    const r = el?.getBoundingClientRect();
    const header = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const visible = !!r && r.top >= header && r.bottom <= window.innerHeight * 0.6;
    const fixed = !!el?.closest(".island-header");
    // "start" respeita o scroll-padding da ilha e deixa espaço para o balão embaixo.
    if (!visible && !fixed) el?.scrollIntoView({ block: "start", inline: "nearest", behavior: reduced ? "auto" : "smooth" });
    const settle = window.setTimeout(() => setSettled(index), visible || fixed || reduced ? 0 : 520);
    let frame = 0;
    const tick = () => {
      const t = findTarget(step.target);
      if (t) {
        const r = t.getBoundingClientRect();
        setBox((b) => (b && b.top === r.top && b.left === r.left && b.width === r.width && b.height === r.height ? b : { top: r.top, left: r.left, width: r.width, height: r.height }));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); window.clearTimeout(settle); };
  }, [open, step, reduced, index]);

  useLayoutEffect(() => {
    if (pop.current) setPopH(pop.current.offsetHeight);
  }, [index, open, box?.width]);

  useEffect(() => {
    if (open) primary.current?.focus({ preventScroll: true });
  }, [open, index]);

  // Teclado em qualquer lugar da página: Esc pula, ← → navegam.
  const total = available.length;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setSeen(true); }
      else if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, total - 1));
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, total, setSeen]);

  if (!open || typeof document === "undefined") return null;
  if (!box || settled !== index) return createPortal(<div className="tour"><div className="tour-backdrop is-dim" aria-hidden /></div>, document.body);

  const finish = () => setSeen(true);
  const last = index === available.length - 1;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const popW = Math.min(360, vw - MARGIN * 2);
  const below = box.top + box.height + GAP + popH <= vh - MARGIN || box.top - GAP - popH < MARGIN;
  const top = below ? Math.min(box.top + box.height + GAP, vh - popH - MARGIN) : Math.max(box.top - GAP - popH, MARGIN);
  const center = box.left + box.width / 2;
  const left = Math.min(Math.max(center - popW / 2, MARGIN), vw - popW - MARGIN);
  const caret = Math.min(Math.max(center - left, 24), popW - 24);
  const Arrow = below ? ArrowUp : ArrowDown;
  const arrowTop = below ? box.top + box.height + 8 : box.top - 8 - 32;

  return createPortal(
    <div className="tour" data-reduced={reduced || undefined}>
      <div className="tour-backdrop" aria-hidden />
      <div key={`spot-${index}`} className="tour-spot" aria-hidden style={{ top: box.top - PAD, left: box.left - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2 }} />
      <Arrow className="tour-arrow" aria-hidden style={{ top: arrowTop, left: center - 16 }} data-dir={below ? "up" : "down"} />
      <div
        key={index}
        ref={pop}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="tour-pop"
        data-side={below ? "below" : "above"}
        style={{ top, left, width: popW, ["--caret" as string]: `${caret}px` }}
      >
        <div className="tour-head">
          <span className="tour-count">{index + 1} de {available.length}</span>
          <button type="button" className="tour-close" onClick={finish} aria-label="Fechar dicas"><X className="size-4" aria-hidden /></button>
        </div>
        <p id="tour-title" className="tour-title">{step.title}</p>
        {step.illustration && <div className="tour-illus" aria-hidden>{step.illustration}</div>}
        <div id="tour-body" className="tour-body">{step.body}</div>
        <div className="tour-dots" aria-hidden>{available.map((s, i) => <span key={s.target + i} data-on={i === index || undefined} />)}</div>
        <div className="tour-actions">
          {index > 0 ? <Button size="sm" variant="ghost" onClick={() => setIndex((i) => i - 1)}>Voltar</Button> : <Button size="sm" variant="ghost" onClick={finish}>Pular</Button>}
          <Button ref={primary} size="sm" variant="primary" onClick={() => (last ? finish() : setIndex((i) => i + 1))}>{last ? "Entendi" : "Próximo"}</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Ilustrações animadas (só CSS; paradas com movimento reduzido) ---------- */

/** Sequência de botões que acendem um de cada vez: o caminho do serviço. */
export function IllusSequence({ items }: { items: string[] }) {
  return (
    <div className="illus-seq" style={{ ["--n" as string]: items.length }}>
      {items.map((t, i) => (
        <span key={t} className="illus-seq-item" style={{ ["--i" as string]: i }}>{t}</span>
      ))}
    </div>
  );
}

/** Cartão que se move de uma coluna para a outra (gesto de arrastar). */
export function IllusDrag() {
  return (
    <div className="illus-drag">
      <span className="illus-col">Aguardando</span>
      <span className="illus-col">Em andamento</span>
      <span className="illus-card"><span /><span /></span>
      <span className="illus-hand" />
    </div>
  );
}

/** Campo de busca sendo digitado. */
export function IllusTyping({ text }: { text: string }) {
  return (
    <div className="illus-type">
      <span className="illus-type-text" style={{ ["--len" as string]: text.length }}>{text}</span>
    </div>
  );
}

/** Clique: um dedo toca o botão e ele afunda. */
export function IllusTap({ label }: { label: string }) {
  return (
    <div className="illus-tap">
      <span className="illus-tap-btn">{label}</span>
      <span className="illus-tap-dot" />
    </div>
  );
}
