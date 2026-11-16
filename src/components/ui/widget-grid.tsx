"use client";

import "react-grid-layout/css/styles.css";
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Eye, EyeOff, LayoutDashboard, Minus, Move, Plus, RotateCcw,
} from "lucide-react";
import { ReactNode, useMemo } from "react";
import GridLayout, { type Layout, type LayoutItem, useContainerWidth, verticalCompactor } from "react-grid-layout";
import { useAccessibility } from "@/components/accessibility/accessibility-provider";
import { usePref } from "@/lib/prefs";
import { Button, cx } from "./primitives";

/**
 * Painel de blocos no estilo dos widgets do macOS: no modo "Personalizar",
 * cada bloco pode ser arrastado, redimensionado pelo canto e ocultado.
 * Fora desse modo o painel fica idêntico ao layout comum, sem controles.
 *
 * O layout é preferência de interface (por usuário e oficina, neste navegador).
 * Todo movimento por arrasto tem alternativa por botões, também pelo teclado
 * (WCAG 2.5.7). Abaixo de 900 px, ou com texto ampliado, os blocos ficam empilhados.
 */

const COLS = 12;
const ROW = 40;
const GAP = 16;
const STACK_BELOW = 900;

export interface Widget {
  id: string;
  title: string;
  /** Posição e tamanho padrão em 12 colunas; cada linha tem 40 px + 16 px de espaço. */
  layout: { x: number; y: number; w: number; h: number; minW?: number; minH?: number };
  render: () => ReactNode;
}

interface Stored {
  layout: LayoutItem[];
  hidden: string[];
}

const EMPTY: Stored = { layout: [], hidden: [] };

export interface WidgetPrefs {
  stored: Stored;
  setStored: (fn: (s: Stored) => Stored) => void;
  reset: () => void;
}

/** Estado do painel compartilhado entre a grade e os botões do cabeçalho. */
export function useWidgetPrefs(prefKey: string): WidgetPrefs {
  const [stored, setStored, reset] = usePref<Stored>(`painel:${prefKey}`, EMPTY);
  return { stored, setStored, reset };
}

/** Junta o layout salvo com os blocos disponíveis agora (permissões e módulos podem mudar). */
function merge(widgets: Widget[], stored: Stored): LayoutItem[] {
  const saved = new Map(stored.layout.map((l) => [l.i, l]));
  return widgets
    .filter((w) => !stored.hidden.includes(w.id))
    .map((w) => {
      const base = { i: w.id, ...w.layout };
      const s = saved.get(w.id);
      return s ? { ...base, x: s.x, y: s.y, w: s.w, h: s.h } : stored.layout.length ? { ...base, y: 1000 } : base;
    });
}

export function WidgetGrid({ prefs, widgets, editing }: { prefs: WidgetPrefs; widgets: Widget[]; editing: boolean }) {
  const { stored, setStored } = prefs;
  const { width, containerRef, mounted } = useContainerWidth();
  const layout = useMemo(() => merge(widgets, stored), [widgets, stored]);
  const byId = useMemo(() => new Map(widgets.map((w) => [w.id, w])), [widgets]);
  const hidden = widgets.filter((w) => stored.hidden.includes(w.id));

  const save = (next: Layout) => setStored((s) => ({ ...s, layout: next.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })) }));
  const hide = (id: string) => setStored((s) => ({ layout: s.layout.length ? s.layout : layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })), hidden: [...s.hidden, id] }));
  const show = (id: string) => setStored((s) => ({ ...s, hidden: s.hidden.filter((h) => h !== id) }));

  /** Alternativa sem arrasto: desloca ou redimensiona um bloco em um passo. */
  const nudge = (id: string, dx: number, dy: number, dw: number) =>
    save(
      layout.map((l) => {
        if (l.i !== id) return l;
        const w = Math.min(COLS, Math.max(l.minW ?? 2, l.w + dw));
        return { ...l, w, x: Math.min(COLS - w, Math.max(0, l.x + dx)), y: Math.max(0, l.y + dy * l.h + (dy < 0 ? -1 : 0)) };
      }),
    );

  // Texto ampliado (preferência de acessibilidade) não cabe em linhas de altura fixa: empilha.
  const { preferences } = useAccessibility();
  const stacked = mounted && (width < STACK_BELOW || preferences.textSize !== "default");
  const ordered = [...layout].sort((a, b) => a.y - b.y || a.x - b.x);

  return (
    <>
      {editing && (
        <div className="widget-edit-note" role="status">
          <p>Arraste os blocos para reorganizar e use o canto inferior direito para mudar o tamanho. Os botões de cada bloco fazem o mesmo pelo teclado.</p>
          {hidden.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span>Ocultos:</span>
              {hidden.map((w) => (
                <Button key={w.id} size="sm" icon={<Eye className="size-4" aria-hidden />} onClick={() => show(w.id)}>
                  Mostrar {w.title}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
      <div ref={containerRef as React.RefObject<HTMLDivElement>} className={cx("widget-grid", editing && "is-editing")}>
        {stacked || !mounted ? (
          <div className="grid grid-cols-2 gap-4">
            {ordered.map((l) => (
              <div key={l.i} className={cx("widget-stacked", l.w > 3 && "col-span-2")}>{byId.get(l.i)!.render()}</div>
            ))}
          </div>
        ) : (
          <GridLayout
            width={width}
            layout={layout}
            gridConfig={{ cols: COLS, rowHeight: ROW, margin: [GAP, GAP], containerPadding: [0, 0] }}
            dragConfig={{ enabled: editing, cancel: ".widget-nodrag", threshold: 4 }}
            resizeConfig={{ enabled: editing, handles: ["se"] }}
            compactor={verticalCompactor}
            onLayoutChange={(l) => editing && save(l)}
          >
            {layout.map((l) => (
              <div key={l.i}>
                <WidgetFrame widget={byId.get(l.i)!} editing={editing} onNudge={(dx, dy, dw) => nudge(l.i, dx, dy, dw)} onHide={() => hide(l.i)} />
              </div>
            ))}
          </GridLayout>
        )}
      </div>
    </>
  );
}

function WidgetFrame({ widget, editing, onNudge, onHide }: { widget: Widget; editing: boolean; onNudge: (dx: number, dy: number, dw: number) => void; onHide: () => void }) {
  const t = widget.title;
  return (
    <section aria-label={editing ? `Bloco ${t}` : undefined} className={cx("widget-frame", editing && "is-editing")}>
      <div className="widget-content" inert={editing}>{widget.render()}</div>
      {editing && (
        <div className="widget-toolbar widget-nodrag" role="group" aria-label={`Organizar ${t}`}>
          <span className="widget-toolbar-title"><Move className="size-4" aria-hidden />{t}</span>
          <span className="widget-toolbar-buttons">
            <button type="button" onClick={() => onNudge(-1, 0, 0)} aria-label={`Mover ${t} para a esquerda`} title="Mover para a esquerda"><ArrowLeft aria-hidden /></button>
            <button type="button" onClick={() => onNudge(0, -1, 0)} aria-label={`Mover ${t} para cima`} title="Mover para cima"><ArrowUp aria-hidden /></button>
            <button type="button" onClick={() => onNudge(0, 1, 0)} aria-label={`Mover ${t} para baixo`} title="Mover para baixo"><ArrowDown aria-hidden /></button>
            <button type="button" onClick={() => onNudge(1, 0, 0)} aria-label={`Mover ${t} para a direita`} title="Mover para a direita"><ArrowRight aria-hidden /></button>
            <button type="button" onClick={() => onNudge(0, 0, -1)} aria-label={`Estreitar ${t}`} title="Estreitar"><Minus aria-hidden /></button>
            <button type="button" onClick={() => onNudge(0, 0, 1)} aria-label={`Alargar ${t}`} title="Alargar"><Plus aria-hidden /></button>
            <button type="button" onClick={onHide} aria-label={`Ocultar ${t}`} title="Ocultar"><EyeOff aria-hidden /></button>
          </span>
        </div>
      )}
    </section>
  );
}

/** Botões do cabeçalho: Personalizar painel / Restaurar padrão / Concluir. */
export function WidgetGridToolbar({ prefs, editing, onEditingChange }: { prefs: WidgetPrefs; editing: boolean; onEditingChange: (editing: boolean) => void }) {
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
