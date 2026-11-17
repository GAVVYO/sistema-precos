"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { ChevronDown, ChevronUp, GripVertical, Maximize2, Minus, PackagePlus, Phone, PictureInPicture2, Plus, Search, Trash2, UserX, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/app-state/app-context";
import { Button, cx, Input, Select } from "@/components/ui/primitives";
import { ScrubNumber } from "@/components/ui/scrub-number";
import { usePip } from "@/components/layout/pip";
import type { ID, Part, ServiceOrder } from "@/domain/types";
import { formatBRL, formatOrderNumber, formatPhone, formatPlate } from "@/lib/format";
import { orderTotals } from "@/services/orders";
import { useOrderActions } from "./order-actions";
import { QuickOrderAction } from "./quick-order-action";
import { orderTotalText, PaymentBadge, StatusBadge, vehicleLabel } from "./shared";

/* ---------- Faixa de mecânicos (alvos de soltura + filtro) ---------- */

function MechanicChip({ id, label, count, active, onClick, enabled }: { id: string; label: string; count: number; active: boolean; onClick: () => void; enabled: boolean }) {
  const { setNodeRef, isOver, active: dragging } = useDroppable({ id: `mech:${id}`, disabled: !enabled });
  const draggingOrder = dragging?.data.current?.type === "order";
  const initials = id === "none" ? null : label.split(" ").slice(0, 2).map((p) => p[0]).join("");
  return (
    <button
      ref={setNodeRef}
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx("mech-chip", draggingOrder && enabled && "is-target", isOver && "is-over")}
      title={draggingOrder ? `Soltar para atribuir a ${label}` : `Filtrar: ${label}`}
    >
      <span className="mech-avatar" aria-hidden>{initials ?? <UserX className="size-4" />}</span>
      <span className="mech-name">{label}</span>
      <span className="mech-count" aria-label={`${count} em aberto`}>{count}</span>
    </button>
  );
}

/**
 * Referência: Tech Board do Tekmetric. Arraste uma OS até um mecânico para
 * atribuir; clicar no chip filtra o quadro. A alternativa sem arraste é o
 * campo "Responsável" do painel lateral.
 */
export function MechanicStrip({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { view, mechanics, can, online } = useApp();
  const open = view.orders.filter((o) => !o.cancelledAt && o.status !== "done");
  const enabled = online && can("os.edit");
  return (
    <div className="mech-strip" role="group" aria-label="Responsáveis: clique para filtrar, solte uma OS para atribuir">
      {mechanics.map((m) => (
        <MechanicChip key={m.id} id={m.id} label={m.name.split(" ").slice(0, 2).join(" ")} count={open.filter((o) => o.mechanicId === m.id).length} active={value === m.id} enabled={enabled} onClick={() => onChange(value === m.id ? "" : m.id)} />
      ))}
      <MechanicChip id="none" label="Sem responsável" count={open.filter((o) => !o.mechanicId).length} active={value === "none"} enabled={enabled} onClick={() => onChange(value === "none" ? "" : "none")} />
    </div>
  );
}

/* ---------- Peças arrastáveis ---------- */

function ShelfPart({ part, onAdd, enabled }: { part: Part; onAdd: () => void; enabled: boolean }) {
  const out = part.quantity <= 0;
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: `part:${part.id}`, data: { type: "part", partId: part.id }, disabled: !enabled || out });
  return (
    <li ref={setNodeRef} className={cx("shelf-part", isDragging && "opacity-40")}>
      {enabled && !out && (
        <button type="button" className="shelf-grip" aria-label={`Arrastar ${part.name} para a OS`} {...attributes} {...listeners}>
          <GripVertical className="size-4" aria-hidden />
        </button>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{part.name}</span>
        <span className={cx("text-xs", out ? "text-danger" : "text-muted")}>{part.code} · {out ? "sem estoque" : `${part.quantity} em estoque`} · {formatBRL(part.priceCents)}</span>
      </span>
      <Button size="sm" variant="ghost" disabled={!enabled || out} onClick={onAdd} aria-label={`Lançar ${part.name} na OS`} title="Lançar 1 unidade">
        <Plus className="size-4" aria-hidden />
      </Button>
    </li>
  );
}

export function PartDragPreview({ partId }: { partId: ID }) {
  const { partOf } = useApp();
  const p = partOf(partId);
  return <div className="part-drag-preview"><PackagePlus className="size-4" aria-hidden /> {p?.name}</div>;
}

/* ---------- Painel lateral ---------- */

const MIN_W = 360;
const MAX_W = 640;

/**
 * Espiar a OS sem sair do quadro (referência: Notion side peek e Quick Look).
 * Setas ↑ ↓ trocam de OS, Esc fecha, a borda esquerda ajusta a largura.
 */
export function OrderPeek({
  order,
  width,
  onWidth,
  onClose,
  onStep,
}: {
  order: ServiceOrder;
  width: number;
  onWidth: (w: number) => void;
  onClose: () => void;
  onStep: (dir: 1 | -1) => void;
}) {
  const { view, can, online, mechanics, customerOf, vehicleOf, partOf, openOrder } = useApp();
  const { assign, setPartQty, addPart, itemsOf, setLabor } = useOrderActions();
  const pip = usePip();
  const [query, setQuery] = useState("");
  const panel = useRef<HTMLElement>(null);
  const { setNodeRef, isOver, active } = useDroppable({ id: `os-parts:${order.id}` });

  const number = formatOrderNumber(order.number);
  const customer = customerOf(order.customerId);
  const vehicle = vehicleOf(order.vehicleId);
  const totals = orderTotals(view, order);
  const items = itemsOf(order);
  const locked = !!order.cancelledAt || !!order.paymentId;
  const doneLock = order.status === "done";
  const canParts = online && (can("os.parts") || can("os.edit")) && !locked && !doneLock;
  const canAssign = online && can("os.edit") && !locked;
  const canLabor = canAssign;
  const draggingPart = active?.data.current?.type === "part";
  const q = query.trim().toLocaleLowerCase("pt-BR");
  const shelf = view.parts
    .filter((p) => !items.some((i) => i.partId === p.id) && (!q || `${p.name} ${p.code}`.toLocaleLowerCase("pt-BR").includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, 8);

  // Esc fecha; ↑ ↓ trocam de OS quando o foco não está num campo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (document.querySelector("dialog[open]") || ["INPUT", "SELECT", "TEXTAREA"].includes(t.tagName)) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (t.closest(".more-menu")) return;
        e.preventDefault();
        onStep(e.key === "ArrowDown" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onStep]);

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    const move = (ev: PointerEvent) => onWidth(Math.min(MAX_W, Math.max(MIN_W, startW + (startX - ev.clientX))));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); document.body.classList.remove("is-resizing"); };
    document.body.classList.add("is-resizing");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <aside ref={panel} className="order-peek" style={{ width }} aria-label={`Resumo da ${number}`}>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Largura do painel"
        aria-valuemin={MIN_W}
        aria-valuemax={MAX_W}
        aria-valuenow={width}
        tabIndex={0}
        className="peek-resizer"
        onPointerDown={startResize}
        onDoubleClick={() => onWidth(400)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") { e.preventDefault(); onWidth(Math.min(MAX_W, width + 24)); }
          if (e.key === "ArrowRight") { e.preventDefault(); onWidth(Math.max(MIN_W, width - 24)); }
        }}
      />
      <header className="peek-header">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold text-primary">{number}</span>
            <StatusBadge order={order} />
            <PaymentBadge order={order} />
          </p>
          <p className="mt-1 text-sm">{order.description}</p>
        </div>
        <div className="flex shrink-0 items-start gap-0.5">
          <button type="button" className="peek-icon" onClick={() => onStep(-1)} aria-label="OS anterior" title="OS anterior (↑)"><ChevronUp className="size-4" aria-hidden /></button>
          <button type="button" className="peek-icon" onClick={() => onStep(1)} aria-label="Próxima OS" title="Próxima OS (↓)"><ChevronDown className="size-4" aria-hidden /></button>
          {pip.supported && (
            <button type="button" className="peek-icon" onClick={() => pip.open(order.id)} aria-label="Destacar em mini janela por cima de tudo" title="Mini janela por cima (útil com o WhatsApp aberto)"><PictureInPicture2 className="size-4" aria-hidden /></button>
          )}
          <button type="button" className="peek-icon" onClick={onClose} aria-label="Fechar painel" title="Fechar (Esc)"><X className="size-4" aria-hidden /></button>
        </div>
      </header>

      <div className="peek-body">
        <dl className="peek-info">
          <div><dt>Cliente</dt><dd>{customer?.name}</dd></div>
          <div><dt>Telefone</dt><dd className="flex items-center gap-1"><Phone className="size-3.5 text-muted" aria-hidden />{customer ? formatPhone(customer.phone) : "—"}</dd></div>
          <div><dt>Veículo</dt><dd>{vehicleLabel(vehicle)} <span className="vehicle-plate">{vehicle ? formatPlate(vehicle.plate) : ""}</span></dd></div>
          <div>
            <dt><label htmlFor={`resp-${order.id}`}>Responsável</label></dt>
            <dd>
              <Select id={`resp-${order.id}`} className="w-full" value={order.mechanicId ?? ""} disabled={!canAssign} onChange={(e) => assign(order, e.target.value || null)}>
                <option value="">A definir</option>
                {mechanics.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </dd>
          </div>
        </dl>

        <section
          ref={setNodeRef}
          aria-label="Peças da OS"
          className={cx("peek-parts", draggingPart && canParts && "is-target", isOver && canParts && "is-over")}
        >
          <h3 className="peek-title">Peças utilizadas</h3>
          {items.length === 0 ? (
            <p className="peek-empty">{canParts ? "Nenhuma peça. Arraste uma peça da lista abaixo para cá ou use o botão +." : "Nenhuma peça lançada."}</p>
          ) : (
            <ul className="divide-y divide-line">
              {items.map((i) => {
                const p = partOf(i.partId);
                return (
                  <li key={i.partId} className="flex items-center gap-2 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p?.name}</span>
                      <span className="text-xs text-muted">{formatBRL(i.unitPriceCents)} cada</span>
                    </span>
                    {canParts ? (
                      <span className="qty-stepper" role="group" aria-label={`Quantidade de ${p?.name}`}>
                        <button type="button" onClick={() => setPartQty(order, i.partId, i.quantity - 1, i.quantity - 1 <= 0 ? `${p?.name} removida. Estoque devolvido.` : `${p?.name}: ${i.quantity - 1} un.`)} aria-label={i.quantity === 1 ? `Remover ${p?.name}` : `Diminuir ${p?.name}`}>
                          {i.quantity === 1 ? <Trash2 className="size-4" aria-hidden /> : <Minus className="size-4" aria-hidden />}
                        </button>
                        <ScrubNumber
                          value={i.quantity}
                          min={0}
                          max={i.quantity + (p?.quantity ?? 0)}
                          step={1}
                          bigStep={5}
                          pxPerStep={14}
                          label={`Quantidade de ${p?.name}`}
                          format={(v) => String(v)}
                          onCommit={(v) => setPartQty(order, i.partId, v, v <= 0 ? `${p?.name} removida. Estoque devolvido.` : `${p?.name}: ${v} un.`)}
                        />
                        <button type="button" onClick={() => setPartQty(order, i.partId, i.quantity + 1, `${p?.name}: ${i.quantity + 1} un.`)} aria-label={`Aumentar ${p?.name}`}><Plus className="size-4" aria-hidden /></button>
                      </span>
                    ) : (
                      <span className="tabular-nums text-muted">{i.quantity} un.</span>
                    )}
                    <span className="w-24 text-right font-semibold tabular-nums">{formatBRL(i.quantity * i.unitPriceCents)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {draggingPart && canParts && <p className="peek-drop-hint" aria-hidden>Solte para lançar 1 unidade</p>}
          {!canParts && !locked && doneLock && <p className="peek-empty">OS concluída: corrija peças em “Abrir completo”, informando o motivo.</p>}
        </section>

        <div className="peek-labor">
          <span className="text-muted">Mão de obra</span>
          {canLabor ? (
            <ScrubNumber
              value={order.laborCents ?? 0}
              step={500}
              bigStep={5000}
              pxPerStep={8}
              label="Mão de obra"
              format={(v) => (order.laborCents === null && v === 0 ? "A definir" : formatBRL(v))}
              onCommit={(v) => setLabor(order, v)}
            />
          ) : (
            <span className="tabular-nums">{order.laborCents === null ? "A definir" : formatBRL(order.laborCents)}</span>
          )}
        </div>
        <div className="peek-total">
          <span className="text-muted">Total</span>
          <strong className="text-lg tabular-nums">{orderTotalText(totals)}</strong>
        </div>

        {canParts && (
          <section className="peek-shelf" aria-label="Peças do estoque">
            <h3 className="peek-title">Adicionar do estoque</h3>
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <Input className="pl-9" placeholder="Buscar peça por nome ou código" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar peça para lançar" />
            </div>
            <ul className="space-y-1">
              {shelf.map((p) => <ShelfPart key={p.id} part={p} enabled={canParts} onAdd={() => addPart(order, p.id)} />)}
              {shelf.length === 0 && <li className="peek-empty">Nenhuma peça encontrada.</li>}
            </ul>
          </section>
        )}
      </div>

      <footer className="peek-footer">
        <Button icon={<Maximize2 className="size-4" aria-hidden />} onClick={() => openOrder(order.id)}>Abrir completo</Button>
        <QuickOrderAction order={order} />
      </footer>
    </aside>
  );
}
