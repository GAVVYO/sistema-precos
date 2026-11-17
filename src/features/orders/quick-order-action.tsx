"use client";

import { Check, CircleDollarSign, Play } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/app-state/app-context";
import { Button } from "@/components/ui/primitives";
import type { ServiceOrder } from "@/domain/types";
import { formatOrderNumber } from "@/lib/format";
import { canChangeStatus, orderTotals, paymentSituation } from "@/services/orders";
import { useMoveOrder } from "./move-order";
import { PaymentDialog } from "./order-dialogs";

/** A próxima ação usa as mesmas permissões e regras dos detalhes da OS. */
export function QuickOrderAction({ order }: { order: ServiceOrder }) {
  const { db, view, user, can, online } = useApp();
  const moveOrder = useMoveOrder();
  const [pay, setPay] = useState(false);
  if (order.cancelledAt) return null;
  const next = order.status === "waiting" ? "in_progress" : order.status === "in_progress" ? "done" : null;
  const allowed = next && canChangeStatus(db, { workshopId: order.workshopId, userId: user.id }, order.status, next);
  const receivable = can("finance.payment") && paymentSituation(order, orderTotals(view, order)) === "pending";
  return (
    <>
      {allowed ? <Button size="sm" variant="primary" disabled={!online} icon={next === "done" ? <Check className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />} onClick={() => moveOrder(order, next, `${formatOrderNumber(order.number)} ${next === "done" ? "está pronto" : "em andamento"}.`)}>{next === "done" ? "Marcar como pronto" : "Começar"}</Button> : receivable ? <Button size="sm" variant="primary" disabled={!online} icon={<CircleDollarSign className="size-3.5" aria-hidden />} onClick={() => setPay(true)}>Receber</Button> : null}
      {pay && <PaymentDialog orderId={order.id} onClose={() => setPay(false)} />}
    </>
  );
}
