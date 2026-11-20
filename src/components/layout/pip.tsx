"use client";

import { ExternalLink } from "lucide-react";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "@/app-state/app-context";
import { Button } from "@/components/ui/primitives";
import type { ID } from "@/domain/types";
import { QuickOrderAction } from "@/features/orders/quick-order-action";
import { orderTotalText, PaymentBadge, StatusBadge, vehicleLabel } from "@/features/orders/shared";
import { formatOrderNumber, formatPhone, formatPlate } from "@/lib/format";
import { orderTotals } from "@/services/orders";

/**
 * Mini janela que fica por cima de tudo, inclusive do WhatsApp Web
 * (Document Picture-in-Picture, Chrome/Edge 116+). Onde não há suporte, o
 * botão simplesmente não aparece. A janela continua aberta ao trocar de módulo.
 */

interface PipApi {
  supported: boolean;
  orderId: ID | null;
  open: (orderId: ID) => void;
  close: () => void;
}

const PipContext = createContext<PipApi>({ supported: false, orderId: null, open: () => {}, close: () => {} });
export const usePip = () => useContext(PipContext);

interface PipWindowApi {
  requestWindow: (o: { width: number; height: number }) => Promise<Window>;
  window: Window | null;
}
const pipApi = (): PipWindowApi | null =>
  typeof window !== "undefined" && "documentPictureInPicture" in window ? (window as unknown as { documentPictureInPicture: PipWindowApi }).documentPictureInPicture : null;

/** Leva estilos, cores da oficina e preferências de acessibilidade para a mini janela. */
function mirrorStyles(win: Window) {
  for (const sheet of [...document.styleSheets]) {
    try {
      const style = win.document.createElement("style");
      style.textContent = [...sheet.cssRules].map((r) => r.cssText).join("\n");
      win.document.head.appendChild(style);
    } catch {
      if (sheet.href) {
        const link = win.document.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        win.document.head.appendChild(link);
      }
    }
  }
  const src = document.documentElement;
  const dst = win.document.documentElement;
  dst.style.cssText = src.style.cssText;
  for (const [k, v] of Object.entries(src.dataset)) dst.dataset[k] = v;
  dst.lang = src.lang;
  win.document.body.className = "pip-body";
}

function PipOrder({ orderId }: { orderId: ID }) {
  const { view, customerOf, vehicleOf, partOf, openOrder } = useApp();
  const order = view.orders.find((o) => o.id === orderId);
  if (!order) return <p className="p-4">Serviço não encontrado.</p>;
  const customer = customerOf(order.customerId);
  const vehicle = vehicleOf(order.vehicleId);
  const items = view.orderItems.filter((i) => i.orderId === order.id);
  return (
    <main className="pip-order">
      <header className="flex flex-wrap items-center gap-2">
        <strong className="text-lg text-primary">{formatOrderNumber(order.number)}</strong>
        <StatusBadge order={order} />
        <PaymentBadge order={order} />
      </header>
      <p className="font-semibold">{customer?.name}</p>
      <p className="text-sm text-muted">{customer ? formatPhone(customer.phone) : ""}</p>
      <p className="text-sm">{vehicleLabel(vehicle)} <span className="vehicle-plate">{vehicle ? formatPlate(vehicle.plate) : ""}</span></p>
      <p className="pip-desc">{order.description}</p>
      {items.length > 0 && (
        <ul className="pip-parts">
          {items.map((i) => <li key={i.id}><span>{partOf(i.partId)?.name}</span><span className="tabular-nums">× {i.quantity}</span></li>)}
        </ul>
      )}
      <p className="flex items-baseline justify-between"><span className="text-muted">Total</span><strong className="text-lg tabular-nums">{orderTotalText(orderTotals(view, order))}</strong></p>
      <footer className="flex items-center justify-between gap-2">
        <Button size="sm" icon={<ExternalLink className="size-4" aria-hidden />} onClick={() => { window.focus(); openOrder(order.id); }}>Abrir no sistema</Button>
        <QuickOrderAction order={order} />
      </footer>
    </main>
  );
}

export function PipProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ win: Window; orderId: ID } | null>(null);
  const supported = !!pipApi();

  const close = useCallback(() => {
    state?.win.close();
    setState(null);
  }, [state]);

  const open = useCallback(async (orderId: ID) => {
    const api = pipApi();
    if (!api) return;
    if (api.window && state) { setState({ win: api.window, orderId }); return; }
    const win = await api.requestWindow({ width: 380, height: 560 });
    mirrorStyles(win);
    win.addEventListener("pagehide", () => setState(null));
    setState({ win, orderId });
  }, [state]);

  // Fecha a mini janela ao sair da área logada.
  useEffect(() => () => { pipApi()?.window?.close(); }, []);

  const value = useMemo(() => ({ supported, orderId: state?.orderId ?? null, open: (id: ID) => void open(id), close }), [supported, state, open, close]);
  return (
    <PipContext.Provider value={value}>
      {children}
      {state && createPortal(<PipOrder orderId={state.orderId} />, state.win.document.body)}
    </PipContext.Provider>
  );
}
