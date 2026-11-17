"use client";

import { useApp } from "@/app-state/app-context";
import { toast } from "@/components/ui/toast";
import { ORDER_STATUS_LABELS } from "@/domain/labels";
import type { OrderStatus, ServiceOrder } from "@/domain/types";
import { formatOrderNumber } from "@/lib/format";
import { canChangeStatus, changeOrderStatus } from "@/services/orders";
import { vtName, withTransition } from "@/lib/view-transition";

/** Cartão voa da coluna atual para a nova, assenta e brilha ao chegar. */
function animateCardMove(orderId: string, run: () => void) {
  const name = vtName("card", orderId);
  const style = document.createElement("style");
  style.textContent = `::view-transition-group(${name}){z-index:20;animation-duration:560ms;animation-timing-function:cubic-bezier(.34,1.25,.64,1)}::view-transition-old(${name}){animation:none;opacity:0}::view-transition-new(${name}){animation:card-land 560ms cubic-bezier(.34,1.25,.64,1) both}`;
  withTransition("move", run, {
    before: () => document.head.appendChild(style),
    done: () => {
      style.remove();
      const card = document.querySelector<HTMLElement>(`.kanban-board [data-order-id="${orderId}"]`);
      if (!card) return;
      card.classList.add("just-moved");
      window.setTimeout(() => card.classList.remove("just-moved"), 1100);
    },
  });
}

/**
 * Muda a etapa da OS e oferece "Desfazer" (também Ctrl/⌘+Z) quando a volta
 * à etapa anterior é permitida pelas mesmas regras do serviço.
 */
export function useMoveOrder() {
  const { db, user, act } = useApp();
  return (order: ServiceOrder, next: OrderStatus, message?: string, opts: { animate?: boolean } = {}) => {
    const number = formatOrderNumber(order.number);
    const from = order.status;
    let res = { ok: false } as ReturnType<typeof act>;
    const run = () => { res = act((d, c) => changeOrderStatus(d, c, order.id, next)); };
    // O cartão "anda" até a próxima coluna (no arraste ele já está na mão: sem animação).
    if (opts.animate === false || !document.querySelector(`.kanban-board [data-order-id="${order.id}"]`)) run();
    else animateCardMove(order.id, run);
    if (!res.ok) return;
    const undoable = canChangeStatus(db, { workshopId: order.workshopId, userId: user.id }, next, from);
    toast(
      "success",
      message ?? `${number} movido para ${ORDER_STATUS_LABELS[next]}.`,
      undoable
        ? { label: "Desfazer", run: () => act((d, c) => changeOrderStatus(d, c, order.id, from), `${number} voltou para ${ORDER_STATUS_LABELS[from]}.`) }
        : undefined,
    );
  };
}
