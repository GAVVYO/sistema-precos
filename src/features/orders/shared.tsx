"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/app-state/app-context";
import { Badge, Button, Input, Select, Tone } from "@/components/ui/primitives";
import { ORDER_STATUS_LABELS } from "@/domain/labels";
import type { ID, OrderStatus, ServiceOrder, Vehicle } from "@/domain/types";
import { centsToInput, formatBRL, parseBRL } from "@/lib/format";
import { OrderItemInput, orderTotals, PAYMENT_SITUATION_LABELS, PaymentSituation, paymentSituation } from "@/services/orders";

export function vehicleLabel(v: Vehicle | undefined): string {
  if (!v) return "Veículo removido";
  return `${v.brand} ${v.model}${v.year ? ` ${v.year}` : ""}`;
}

const STATUS_TONE: Record<OrderStatus, Tone> = { waiting: "warning", in_progress: "info", done: "success" };

export function StatusBadge({ order }: { order: ServiceOrder }) {
  if (order.cancelledAt) return <Badge tone="danger">Cancelada</Badge>;
  return <Badge tone={STATUS_TONE[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Badge>;
}

const PAYMENT_TONE: Record<PaymentSituation, Tone> = {
  paid: "success",
  pending: "warning",
  undefined: "neutral",
  free: "neutral",
  cancelled: "danger",
};

export function PaymentBadge({ order }: { order: ServiceOrder }) {
  const { view } = useApp();
  const situation = paymentSituation(order, orderTotals(view, order));
  if (situation === "cancelled") return null;
  return <Badge tone={PAYMENT_TONE[situation]}>{PAYMENT_SITUATION_LABELS[situation]}</Badge>;
}

/** Total da OS deixando claro quando a mão de obra ainda não foi informada. */
export function orderTotalText(totals: ReturnType<typeof orderTotals>): string {
  if (!totals.laborPending) return formatBRL(totals.totalCents);
  return totals.partsCents > 0 ? `${formatBRL(totals.partsCents)} + mão de obra` : "A definir";
}

/* ---------- Editor de peças ---------- */

export interface DraftItem {
  partId: ID;
  quantity: string;
  price: string;
}

export function toDrafts(items: { partId: ID; quantity: number; unitPriceCents: number }[]): DraftItem[] {
  return items.map((i) => ({ partId: i.partId, quantity: String(i.quantity), price: centsToInput(i.unitPriceCents) }));
}

/** Converte o rascunho em itens válidos ou devolve a mensagem de erro. */
export function draftsToItems(drafts: DraftItem[]): OrderItemInput[] | string {
  const items: OrderItemInput[] = [];
  for (const d of drafts) {
    const quantity = Number(d.quantity);
    const unitPriceCents = parseBRL(d.price);
    if (!Number.isInteger(quantity) || quantity < 1) return "Informe quantidades inteiras a partir de 1 para todas as peças.";
    if (unitPriceCents === null) return "Informe um preço de venda válido para todas as peças.";
    items.push({ partId: d.partId, quantity, unitPriceCents });
  }
  return items;
}

export function draftsTotal(drafts: DraftItem[]): number {
  return drafts.reduce((sum, d) => sum + (Number(d.quantity) || 0) * (parseBRL(d.price) ?? 0), 0);
}

export function PartsEditor({
  drafts,
  onChange,
  alreadyUsed,
}: {
  drafts: DraftItem[];
  onChange: (next: DraftItem[]) => void;
  /** Quantidades que esta OS já baixou do estoque (por peça). */
  alreadyUsed?: Map<ID, number>;
}) {
  const { view, partOf } = useApp();
  const [picked, setPicked] = useState("");
  const available = (partId: ID) => (partOf(partId)?.quantity ?? 0) + (alreadyUsed?.get(partId) ?? 0);
  const options = view.parts
    .filter((p) => !drafts.some((d) => d.partId === p.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const update = (partId: ID, patch: Partial<DraftItem>) =>
    onChange(drafts.map((d) => (d.partId === partId ? { ...d, ...patch } : d)));

  const add = () => {
    const part = partOf(picked);
    if (!part) return;
    onChange([...drafts, { partId: part.id, quantity: "1", price: centsToInput(part.priceCents) }]);
    setPicked("");
  };

  return (
    <div className="space-y-2">
      {drafts.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="data-table">
            <thead>
              <tr>
                <th>Peça</th>
                <th className="w-24">Qtd.</th>
                <th className="w-32">Preço unit. (R$)</th>
                <th className="num w-28">Subtotal</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {drafts.map((d) => {
                const part = partOf(d.partId);
                const qty = Number(d.quantity) || 0;
                const over = qty > available(d.partId);
                return (
                  <tr key={d.partId}>
                    <td>
                      <div className="font-medium">{part?.name ?? "Peça removida"}</div>
                      <div className={over ? "text-xs font-medium text-danger" : "text-xs text-muted"}>
                        {part?.code} · {over ? `apenas ${available(d.partId)} disponíveis` : `${available(d.partId)} disponíveis`}
                      </div>
                    </td>
                    <td>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={d.quantity}
                        aria-label={`Quantidade de ${part?.name}`}
                        aria-invalid={over || undefined}
                        onChange={(e) => update(d.partId, { quantity: e.target.value })}
                        className="h-8"
                      />
                    </td>
                    <td>
                      <Input
                        inputMode="decimal"
                        value={d.price}
                        aria-label={`Preço unitário de ${part?.name}`}
                        onChange={(e) => update(d.partId, { price: e.target.value })}
                        className="h-8"
                      />
                    </td>
                    <td className="num">{formatBRL(qty * (parseBRL(d.price) ?? 0))}</td>
                    <td>
                      <button
                        type="button"
                        aria-label={`Remover ${part?.name}`}
                        className="rounded p-1 text-muted hover:bg-danger-soft hover:text-danger"
                        onClick={() => onChange(drafts.filter((x) => x.partId !== d.partId))}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex gap-2">
        <Select value={picked} onChange={(e) => setPicked(e.target.value)} aria-label="Peça do estoque">
          <option value="">{options.length ? "Selecionar peça do estoque…" : "Todas as peças já foram adicionadas"}</option>
          {options.map((p) => (
            <option key={p.id} value={p.id} disabled={p.quantity <= 0}>
              {p.name} ({p.code}) — {p.quantity > 0 ? `${p.quantity} em estoque` : "sem estoque"} — {formatBRL(p.priceCents)}
            </option>
          ))}
        </Select>
        <Button onClick={add} disabled={!picked} icon={<Plus className="size-4" aria-hidden />}>
          Adicionar peça
        </Button>
      </div>
    </div>
  );
}
