"use client";

import { useApp } from "@/app-state/app-context";
import { NewOrderDialog } from "./new-order-dialog";
import { OrderDetailsDialog } from "./order-details-dialog";

/** Modais acessíveis de qualquer tela: Nova OS e detalhes da OS. */
export function GlobalDialogs() {
  const { openOrderId, openOrder, newOrder, closeNewOrder } = useApp();
  return (
    <>
      {openOrderId && <OrderDetailsDialog key={openOrderId} orderId={openOrderId} onClose={() => openOrder(null)} />}
      {newOrder && <NewOrderDialog prefill={newOrder} onClose={closeNewOrder} />}
    </>
  );
}
