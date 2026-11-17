"use client";

import { useApp } from "@/app-state/app-context";
import { toast } from "@/components/ui/toast";
import type { ID, ServiceOrder } from "@/domain/types";
import { formatBRL, formatOrderNumber } from "@/lib/format";
import { ORDER_STATUS_LABELS } from "@/domain/labels";
import type { OrderStatus } from "@/domain/types";
import { canChangeStatus, changeOrderStatus, setOrderItems, updateOrder } from "@/services/orders";

/** Dados da OS que o `updateOrder` exige, mantendo tudo igual exceto o que muda. */
function details(order: ServiceOrder, mechanicId: ID | null) {
  return { description: order.description, notes: order.notes, laborCents: order.laborCents, mileage: order.mileage, mechanicId };
}

/**
 * Ações rápidas da OS usadas por arraste e por clique, sempre pelos serviços
 * existentes e com "Desfazer" (também Ctrl/⌘+Z).
 */
export function useOrderActions() {
  const { db, view, act, user, userOf } = useApp();

  /** Atribui (ou remove) o responsável. Referência: Tech Board do Tekmetric. */
  const assign = (order: ServiceOrder, mechanicId: ID | null) => {
    if (order.mechanicId === mechanicId) return;
    const before = order.mechanicId;
    const number = formatOrderNumber(order.number);
    const r = act((d, c) => updateOrder(d, c, order.id, details(order, mechanicId)));
    if (!r.ok) return;
    const who = mechanicId ? userOf(mechanicId)?.name.split(" ")[0] : null;
    toast("success", who ? `${number} atribuído a ${who}.` : `${number} ficou sem responsável.`, {
      label: "Desfazer",
      run: () => act((d, c) => updateOrder(d, c, order.id, details(order, before)), `${number}: responsável restaurado.`),
    });
  };

  const itemsOf = (order: ServiceOrder) =>
    view.orderItems.filter((i) => i.orderId === order.id).map(({ partId, quantity, unitPriceCents }) => ({ partId, quantity, unitPriceCents }));

  /**
   * Muda a quantidade de uma peça na OS (0 remove). O serviço movimenta o
   * estoque só pela diferença e recusa saldo negativo.
   */
  const setPartQty = (order: ServiceOrder, partId: ID, quantity: number, message: string) => {
    const before = itemsOf(order);
    const part = view.parts.find((p) => p.id === partId);
    if (!part) return;
    const exists = before.some((i) => i.partId === partId);
    const next = quantity <= 0
      ? before.filter((i) => i.partId !== partId)
      : exists
        ? before.map((i) => (i.partId === partId ? { ...i, quantity } : i))
        : [...before, { partId, quantity, unitPriceCents: part.priceCents }];
    const r = act((d, c) => setOrderItems(d, c, order.id, next));
    if (!r.ok) return;
    toast("success", message, {
      label: "Desfazer",
      run: () => act((d, c) => setOrderItems(d, c, order.id, before), "Peças restauradas e estoque devolvido."),
    });
  };

  const addPart = (order: ServiceOrder, partId: ID) => {
    const current = itemsOf(order).find((i) => i.partId === partId)?.quantity ?? 0;
    const part = view.parts.find((p) => p.id === partId);
    setPartQty(order, partId, current + 1, `${part?.name ?? "Peça"} lançada no ${formatOrderNumber(order.number)}. Estoque baixado.`);
  };

  /**
   * Ações em lote (seleção múltipla e bandeja): aplica uma a uma pelas mesmas
   * regras, pula as recusadas e oferece um único "Desfazer" para o lote.
   */
  const moveMany = (orders: ServiceOrder[], status: OrderStatus) => {
    const moved: { order: ServiceOrder; from: OrderStatus }[] = [];
    for (const o of orders) {
      if (o.status === status || o.cancelledAt) continue;
      if (!canChangeStatus(db, { workshopId: o.workshopId, userId: user.id }, o.status, status)) continue;
      if (act((d, c) => changeOrderStatus(d, c, o.id, status)).ok) moved.push({ order: o, from: o.status });
    }
    if (!moved.length) return;
    const skipped = orders.length - moved.length;
    toast("success", `${moved.length} ${moved.length === 1 ? "serviço movido" : "serviços movidos"} para ${ORDER_STATUS_LABELS[status]}${skipped ? ` (${skipped} sem alteração)` : ""}.`, {
      label: "Desfazer",
      run: () => {
        for (const m of moved) act((d, c) => changeOrderStatus(d, c, m.order.id, m.from));
        toast("success", "Mudança desfeita.");
      },
    });
  };

  const assignMany = (orders: ServiceOrder[], mechanicId: ID | null) => {
    const changed: ServiceOrder[] = [];
    for (const o of orders) {
      if (o.mechanicId === mechanicId || o.cancelledAt || o.paymentId) continue;
      if (act((d, c) => updateOrder(d, c, o.id, details(o, mechanicId))).ok) changed.push(o);
    }
    if (!changed.length) return;
    const who = mechanicId ? userOf(mechanicId)?.name.split(" ")[0] : null;
    toast("success", `${changed.length} ${changed.length === 1 ? "serviço" : "serviços"} ${who ? `atribuído(s) a ${who}` : "sem responsável"}.`, {
      label: "Desfazer",
      run: () => {
        for (const o of changed) act((d, c) => updateOrder(d, c, o.id, details(o, o.mechanicId)));
        toast("success", "Responsáveis restaurados.");
      },
    });
  };

  /** Mão de obra (centavos). Recusada pelo serviço se a OS já foi paga. */
  const setLabor = (order: ServiceOrder, laborCents: number) => {
    const before = order.laborCents;
    const number = formatOrderNumber(order.number);
    const input = (v: number | null) => ({ ...details(order, order.mechanicId), laborCents: v });
    const r = act((d, c) => updateOrder(d, c, order.id, input(laborCents)));
    if (!r.ok) return;
    toast("success", `${number}: mão de obra ${formatBRL(laborCents)}.`, {
      label: "Desfazer",
      run: () => act((d, c) => updateOrder(d, c, order.id, input(before)), `${number}: mão de obra restaurada.`),
    });
  };

  return { assign, setPartQty, addPart, itemsOf, moveMany, assignMany, setLabor };
}
