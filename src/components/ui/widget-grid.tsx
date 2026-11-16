"use client";

import "react-grid-layout/css/styles.css";
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Eye, EyeOff, GripVertical, LayoutDashboard, Minus, Plus, RotateCcw, Check,
} from "lucide-react";
import { ReactNode, useMemo } from "react";
import GridLayout, { type Layout, type LayoutItem, useContainerWidth, verticalCompactor } from "react-grid-layout";
import { usePref } from "@/lib/prefs";
import { Button, cx } from "./primitives";

/**
 * Painel de widgets no estilo dos widgets do macOS / dashboards do Grafana:
 * arrastar pelo cabeçalho, redimensionar pelo canto, mostrar/ocultar.
 * O layout é preferência de interface, salvo por usuário e oficina.
 *
 * Acessibilidade (WCAG 2.5.7): todo movimento por arrasto tem alternativa por
 * botões no modo de edição, que também funcionam pelo teclado.
 */

export const GRID_COLS = 12;

export interface Widget {
  id: string;
  title: string;
  /** Posição e tamanho padrão (12 colunas; cada linha tem ROW px). */
  layout: { x: number; y: number; w: number; h: number; minW?: number; minH?: number };
  render: () => ReactNode;
}

interface Stored {
  layout: LayoutItem[];
  hidden: string[];
}

const ROW = 36;
const EMPTY: Stored = { layout: [], hidden: [] };

function defaults(widgets: Widget[]): LayoutItem[] {
  return widgets.map((w) => ({ i: w.id, ...w.layout }));
}

/** Junta o layout salvo com os widgets disponíveis agora (permissões/módulos podem ter mudado). */
function merge(widgets: Widget[], stored: Stored): LayoutItem[] {
  const saved = new Map(stored.layout.map((l) => [l.i, l]));
  return widgets
    .filter((w) => !stored.hidden.includes(w.id))
    .map((w) => {
      const s = saved.get(w.id);
      const base = { i: w.id, ...w.layout };
      return s ? { ...base, x: s.x, y: s.y, w: s.w, h: s.h } : { ...base, y: 1000 };
    });
}

export interface WidgetPrefs {
  stored: Stored;
  setStored: (fn: (s: Stored) => Stored) => void;
  reset: () => void;
}

/** Estado do painel (layout + ocultos), compartilhado entre a grade e a barra. */
export function useWidgetPrefs(prefKey: string): WidgetPrefs {
  const [stored, setStored, reset] = usePref<Stored>(prefKey, EMPTY);
  return { stored, setStored, reset };
}

export function WidgetGrid({
  prefs,
  widgets,
  editing,
}: {
  prefs: WidgetPrefs;
  widgets: Widget[];
  editing: boolean;
}) {
  const { stored, setStored } = prefs;
  const { width, containerRef, mounted } = useContainerWidth();
  const layout = useMemo(() => merge(widgets, stored.layout.length ? stored : { ...stored, layout: defaults(widgets) }), [widgets, stored]);
  const byId = useMemo(() => new Map(widgets.map((w) => [w.id, w])), [widgets]);

  const save = (next: Layout) =>
    setStored((s) => ({ ...s, layout: next.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })) }));

  /** Alternativa sem arrasto: desloca ou redimensiona um widget em uma unidade. */
  const nudge = (id: string, dx: number, dy: number, dw: number) => {
    const next = layout.map((l) => {
      if (l.i !== id) return l;
      const minW = l.minW ?? 2;
      const w = Math.min(GRID_COLS, Math.max(minW, l.w + dw));
      return { ...l, w, x: Math.min(GRID_COLS - w, Math.max(0, l.x + dx)), y: Math.max(0, l.y + dy * l.h) };
    });
    save(next);
  };

  const hidden = widgets.filter((w) => stored.hidden.includes(w.id));

  return (
    <>
    {editing && hidden.length > 0 && (
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[13px] text-muted">
        <span>Blocos ocultos:</span>
        {hidden.map((w) => (
          <Button key={w.id} size="sm" icon={<Eye className="size-3.5" aria-hidden />} onClick={() => setStored((s) => ({ ...s, hidden: s.hidden.filter((h) => h !== w.id) }))}>
            Mostrar {w.title}
          </Button>
        ))}
      </div>
    )}
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className={cx("widget-grid -mx-2", editing && "is-editing")}>
      {mounted && (
        <GridLayout
          width={width}
          layout={layout}
          gridConfig={{ cols: GRID_COLS, rowHeight: ROW, margin: [12, 12], containerPadding: [8, 0] }}
          dragConfig={{ enabled: editing, handle: ".widget-handle", cancel: ".widget-nodrag", threshold: 4 }}
          resizeConfig={{ enabled: editing, handles: ["se", "e", "s"] }}
          compactor={verticalCompactor}
          onLayoutChange={(l) => editing && save(l)}
        >
          {layout.map((l) => {
            const w = byId.get(l.i)!;
            return (
              <div key={l.i} className="flex">
                <WidgetFrame widget={w} compact={l.w <= 2} editing={editing} onNudge={(dx, dy, dw) => nudge(l.i, dx, dy, dw)} onHide={() => setStored((s) => ({ ...s, layout: s.layout.length ? s.layout : defaults(widgets), hidden: [...s.hidden, l.i] }))} />
              </div>
            );
          })}
        </GridLayout>
      )}
    </div>
    </>
  );
}

function WidgetFrame({
  widget,
  compact,
  editing,
  onNudge,
  onHide,
}: {
  widget: Widget;
  compact: boolean;
  editing: boolean;
  onNudge: (dx: number, dy: number, dw: number) => void;
  onHide: () => void;
}) {
  const btn = "widget-nodrag rounded p-0.5 text-muted hover:bg-slate-100 hover:text-ink";
  return (
    <section
      aria-label={widget.title}
      className={cx(
        "group flex min-w-0 flex-1 flex-col overflow-hidden rounded-md border bg-surface transition-shadow",
        editing ? "border-primary/40 shadow-sm ring-1 ring-primary/10" : "border-line",
      )}
    >
      {editing && (
        <div className="widget-handle relative flex h-7 shrink-0 cursor-grab items-center gap-1 border-b border-line bg-primary-soft px-1.5 text-xs text-primary active:cursor-grabbing">
          <GripVertical className="size-3.5" aria-hidden />
          <span className="min-w-0 flex-1 truncate font-medium">{widget.title}</span>
          {/* Em blocos estreitos os controles aparecem ao passar o mouse ou ao focar pelo teclado. */}
          <span className={cx("flex items-center bg-primary-soft", compact && "absolute right-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100")} role="group" aria-label={`Posição e tamanho de ${widget.title}`}>
            <button type="button" className={btn} onClick={() => onNudge(-1, 0, 0)} aria-label={`Mover ${widget.title} para a esquerda`}><ArrowLeft className="size-3.5" aria-hidden /></button>
            <button type="button" className={btn} onClick={() => onNudge(0, -1, 0)} aria-label={`Mover ${widget.title} para cima`}><ArrowUp className="size-3.5" aria-hidden /></button>
            <button type="button" className={btn} onClick={() => onNudge(0, 1, 0)} aria-label={`Mover ${widget.title} para baixo`}><ArrowDown className="size-3.5" aria-hidden /></button>
            <button type="button" className={btn} onClick={() => onNudge(1, 0, 0)} aria-label={`Mover ${widget.title} para a direita`}><ArrowRight className="size-3.5" aria-hidden /></button>
            <span className="mx-0.5 h-3.5 w-px bg-primary/20" aria-hidden />
            <button type="button" className={btn} onClick={() => onNudge(0, 0, -1)} aria-label={`Estreitar ${widget.title}`}><Minus className="size-3.5" aria-hidden /></button>
            <button type="button" className={btn} onClick={() => onNudge(0, 0, 1)} aria-label={`Alargar ${widget.title}`}><Plus className="size-3.5" aria-hidden /></button>
            <button type="button" className={btn} onClick={onHide} aria-label={`Ocultar ${widget.title}`}><EyeOff className="size-3.5" aria-hidden /></button>
          </span>
        </div>
      )}
      <div className={cx("min-h-0 flex-1 overflow-auto", editing && "pointer-events-none select-none")}>{widget.render()}</div>
    </section>
  );
}

/** Botões do modo de edição: personalizar, restaurar padrão, concluir. */
export function WidgetGridToolbar({
  prefs,
  editing,
  onEditingChange,
}: {
  prefs: WidgetPrefs;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}) {

  if (!editing) {
    return (
      <Button icon={<LayoutDashboard className="size-4" aria-hidden />} onClick={() => onEditingChange(true)}>
        Personalizar painel
      </Button>
    );
  }
  return (
    <>
      <Button icon={<RotateCcw className="size-4" aria-hidden />} onClick={prefs.reset}>Restaurar padrão</Button>
      <Button variant="primary" icon={<Check className="size-4" aria-hidden />} onClick={() => onEditingChange(false)}>Concluir</Button>
    </>
  );
}
