"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { ArrowRight, ChevronDown, ChevronUp, ClipboardList, GripVertical, Inbox, Package, UserCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import { useApp } from "@/app-state/app-context";
import { MoreMenu } from "@/components/ui/more-menu";
import { cx } from "@/components/ui/primitives";
import { ORDER_STATUS_LABELS, ORDER_STATUSES } from "@/domain/labels";
import type { ID } from "@/domain/types";
import { useOrderActions } from "@/features/orders/order-actions";
import { formatOrderNumber, formatPlate } from "@/lib/format";
import { usePref } from "@/lib/prefs";

/**
 * Bandeja "segurar para depois" (referência: Yoink e Dropover no macOS):
 * guarda OS e peças enquanto o atendente faz outra coisa, sem perder o fio.
 * É preferência local (por usuário e oficina); não altera dados.
 */

export type TrayItem = { type: "order" | "part"; id: ID };

interface TrayValue {
  items: TrayItem[];
  add: (items: TrayItem[]) => void;
  remove: (item: TrayItem) => void;
  clear: () => void;
  has: (item: TrayItem) => boolean;
}

const TrayContext = createContext<TrayValue | null>(null);

export function useTray(): TrayValue {
  const v = useContext(TrayContext);
  if (!v) throw new Error("useTray requer TrayProvider.");
  return v;
}

const same = (a: TrayItem, b: TrayItem) => a.type === b.type && a.id === b.id;

export function TrayProvider({ children }: { children: ReactNode }) {
  const { membership, user } = useApp();
  const [items, setItems] = usePref<TrayItem[]>(`bandeja:${membership.workshopId}:${user.id}`, []);
  const value = useMemo<TrayValue>(
    () => ({
      items,
      add: (next) => setItems((cur) => [...cur, ...next.filter((n) => !cur.some((c) => same(c, n)))]),
      remove: (item) => setItems((cur) => cur.filter((c) => !same(c, item))),
      clear: () => setItems([]),
      has: (item) => items.some((c) => same(c, item)),
    }),
    [items, setItems],
  );
  return <TrayContext.Provider value={value}>{children}</TrayContext.Provider>;
}

function TrayRow({ item, dnd }: { item: TrayItem; dnd: boolean }) {
  const { view, customerOf, vehicleOf, partOf, openOrder } = useApp();
  const { remove } = useTray();
  const router = useRouter();
  const order = item.type === "order" ? view.orders.find((o) => o.id === item.id) : undefined;
  const part = item.type === "part" ? partOf(item.id) : undefined;
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `tray-${item.type}:${item.id}`,
    data: item.type === "order" ? { type: "order", orderId: item.id, fromTray: true } : { type: "part", partId: item.id, fromTray: true },
    disabled: !dnd || (item.type === "order" && !!order?.cancelledAt),
  });
  if (!order && !part) return null;
  const v = order ? vehicleOf(order.vehicleId) : undefined;
  const title = order ? formatOrderNumber(order.number) : part!.name;
  const detail = order ? `${customerOf(order.customerId)?.name ?? ""} · ${v ? formatPlate(v.plate) : ""}` : `${part!.code} · ${part!.quantity} em estoque`;
  return (
    <li ref={setNodeRef} className={cx("tray-row", isDragging && "opacity-40")}>
      {dnd && (
        <button type="button" className="tray-grip" aria-label={`Arrastar ${title} da bandeja`} {...attributes} {...listeners}>
          <GripVertical className="size-4" aria-hidden />
        </button>
      )}
      <button
        type="button"
        className="tray-main"
        onClick={() => (order ? openOrder(order.id) : router.push(`/estoque?q=${encodeURIComponent(part!.code)}`))}
      >
        <span className="tray-icon" aria-hidden>{order ? <ClipboardList className="size-4" /> : <Package className="size-4" />}</span>
        <span className="min-w-0">
          <span className="block truncate font-semibold">{title}</span>
          <span className="block truncate text-sm text-muted">{detail}</span>
        </span>
      </button>
      <button type="button" className="tray-remove" onClick={() => remove(item)} aria-label={`Tirar ${title} da bandeja`} title="Tirar da bandeja">
        <X className="size-4" aria-hidden />
      </button>
    </li>
  );
}

/**
 * A bandeja flutuante. Com `dnd` (dentro do quadro de OS) ela também é alvo
 * de soltura e seus itens podem ser arrastados de volta para colunas,
 * responsáveis ou para a OS aberta no painel.
 */
export function TrayDock({ dnd = false }: { dnd?: boolean }) {
  const { view, mechanics, can, online } = useApp();
  const { items, clear } = useTray();
  const { moveMany, assignMany } = useOrderActions();
  const [open, setOpen] = useState(true);
  // Vazia, a bandeja fica fechada; clicar mostra para que ela serve.
  const [hint, setHint] = useState(false);
  const { setNodeRef, isOver, active } = useDroppable({ id: "tray", disabled: !dnd });
  const dragging = !!active && !String(active.id).startsWith("tray-");
  const orders = items.flatMap((i) => (i.type === "order" ? view.orders.filter((o) => o.id === i.id && !o.cancelledAt) : []));
  const count = items.length;

  if (!dnd && count === 0) return null;
  // Vazia e sem arraste em curso: só a pílula, para não cobrir o conteúdo.
  const showBody = dragging || (count > 0 ? open : hint);

  return (
    <aside
      ref={setNodeRef}
      aria-label={`Bandeja: ${count} ${count === 1 ? "item" : "itens"}`}
      className={cx("tray-dock", dragging && "is-target", isOver && "is-over", !showBody && "is-collapsed")}
    >
      <header className="tray-head">
        <button type="button" className="tray-toggle" aria-expanded={showBody} onClick={() => (count > 0 ? setOpen((o) => !o) : setHint((h) => !h))} title="Guarde serviços ou peças para achar rápido depois">
          <Inbox className="size-4" aria-hidden />
          <span>Bandeja</span>
          <span className="tray-count">{count}</span>
          {(showBody ? <ChevronDown className="size-4" aria-hidden /> : <ChevronUp className="size-4" aria-hidden />)}
        </button>
        {open && orders.length > 0 && (
          <MoreMenu
            label="Ações com os serviços da bandeja"
            items={[
              ...ORDER_STATUSES.map((s, i) => ({ label: ORDER_STATUS_LABELS[s], group: i === 0 ? `Mover ${orders.length} ${orders.length === 1 ? "serviço" : "serviços"} para` : undefined, icon: <ArrowRight className="size-4" />, disabled: !online, onSelect: () => moveMany(orders, s) })),
              ...(can("os.edit")
                ? mechanics.map((m, i) => ({ label: m.name, group: i === 0 ? "Passar todos para" : undefined, icon: <UserCheck className="size-4" />, disabled: !online, onSelect: () => assignMany(orders, m.id) }))
                : []),
              { label: "Esvaziar bandeja", icon: <X className="size-4" />, onSelect: clear, group: " " },
            ]}
          />
        )}
      </header>
      {showBody && (
        count === 0 ? (
          <p className="tray-empty">{dragging ? "Solte aqui para guardar" : "Guarde aqui um serviço ou peça para achar rápido depois. No botão ⋯ do cartão, escolha “Guardar na bandeja” (ou arraste até aqui)."}</p>
        ) : (
          <ul className="tray-list">
            {items.map((i) => <TrayRow key={`${i.type}:${i.id}`} item={i} dnd={dnd} />)}
          </ul>
        )
      )}
      {dragging && showBody && count > 0 && <p className="tray-drop-hint">Solte para guardar</p>}
    </aside>
  );
}
