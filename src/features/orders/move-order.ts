"use client";

import { useApp } from "@/app-state/app-context";
import { toast } from "@/components/ui/toast";
import { ORDER_STATUS_LABELS } from "@/domain/labels";
import type { OrderStatus, ServiceOrder } from "@/domain/types";
import { formatOrderNumber } from "@/lib/format";
import { canChangeStatus, changeOrderStatus } from "@/services/orders";

/**
 * Muda a etapa da OS e oferece "Desfazer" (também Ctrl/⌘+Z) quando a volta
 * à etapa anterior é permitida pelas mesmas regras do serviço.
 */
export function useMoveOrder() {
  const { db, user, act } = useApp();
  return (order: ServiceOrder, next: OrderStatus, message?: string) => {
    const number = formatOrderNumber(order.number);
    const from = order.status;
    const res = act((d, c) => changeOrderStatus(d, c, order.id, next));
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
