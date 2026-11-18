"use client";

import { useApp } from "@/app-state/app-context";
import { toast } from "@/components/ui/toast";
import { ORDER_STATUS_LABELS } from "@/domain/labels";
import type { OrderStatus, ServiceOrder } from "@/domain/types";
import { formatOrderNumber } from "@/lib/format";
import { canChangeStatus, changeOrderStatus } from "@/services/orders";
import { withTransition } from "@/lib/view-transition";

/**
 * O carro sai da lista da etapa e voa até a aba da próxima etapa (como um e-mail
 * que vai para a pasta no Mail); a aba pula e mostra o número novo.
 */
function animateToTab(orderId: string, next: string, run: () => void) {
  const row = document.querySelector<HTMLElement>(`.svc-list [data-order-id="${orderId}"]`);
  const tab = document.querySelector<HTMLElement>(`.stage-tab[data-stage="${next}"]`);
  if (!row || !tab) return run();
  withTransition("totab", run, {
    before: () => { row.style.setProperty("view-transition-name", "svc-fly"); },
    after: () => { tab.style.setProperty("view-transition-name", "svc-fly"); },
    done: () => {
      tab.style.removeProperty("view-transition-name");
      tab.classList.add("just-got");
      window.setTimeout(() => tab.classList.remove("just-got"), 700);
    },
  });
}

/** Na tela Hoje, a linha do carro desce para o grupo da próxima etapa e brilha ao chegar. */
function animateYardMove(orderId: string, run: () => void) {
  withTransition("yard", run, {
    done: () => {
      const row = document.querySelector<HTMLElement>(`.yard [data-order-id="${orderId}"]`);
      if (!row) return;
      row.classList.add("just-moved");
      window.setTimeout(() => row.classList.remove("just-moved"), 1100);
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
    if (opts.animate !== false && document.querySelector(`.yard [data-order-id="${order.id}"]`)) animateYardMove(order.id, run);
    else if (opts.animate !== false && document.querySelector(`.svc-list [data-order-id="${order.id}"]`)) animateToTab(order.id, next, run);
    else run();
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
