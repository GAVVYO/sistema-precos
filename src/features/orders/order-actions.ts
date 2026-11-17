"use client";

import { useApp } from "@/app-state/app-context";
import { toast } from "@/components/ui/toast";
import type { ID, ServiceOrder } from "@/domain/types";
import { formatOrderNumber } from "@/lib/format";
import { setOrderItems, updateOrder } from "@/services/orders";

/** Dados da OS que o `updateOrder` exige, mantendo tudo igual exceto o que muda. */
function details(order: ServiceOrder, mechanicId: ID | null) {
  return { description: order.description, notes: order.notes, laborCents: order.laborCents, mileage: order.mileage, mechanicId };
}

/**
 * Ações rápidas da OS usadas por arraste e por clique, sempre pelos serviços
 * existentes e com "Desfazer" (também Ctrl/⌘+Z).
 */
export function useOrderActions() {
  const { view, act, userOf } = useApp();

  /** Atribui (ou remove) o responsável. Referência: Tech Board do Tekmetric. */
  const assign = (order: ServiceOrder, mechanicId: ID | null) => {
    if (order.mechanicId === mechanicId) return;
    const before = order.mechanicId;
    const number = formatOrderNumber(order.number);
    const r = act((d, c) => updateOrder(d, c, order.id, details(order, mechanicId)));
    if (!r.ok) return;
    const who = mechanicId ? userOf(mechanicId)?.name.split(" ")[0] : null;
    toast("success", who ? `${number} atribuída a ${who}.` : `${number} ficou sem responsável.`, {
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
    setPartQty(order, partId, current + 1, `${part?.name ?? "Peça"} lançada na ${formatOrderNumber(order.number)}. Estoque baixado.`);
  };

  return { assign, setPartQty, addPart, itemsOf };
}
