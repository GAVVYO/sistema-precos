"use client";

import {
  CollisionDetection, DndContext, DragEndEvent, pointerWithin, rectIntersection, DragOverlay, DragStartEvent, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { ArrowRight, ClipboardList, ExternalLink, GripVertical, Plus, Search, SearchX, User } from "lucide-react";
import { createContext, useContext, useMemo, useState } from "react";
import { useApp } from "@/app-state/app-context";
import { Dialog } from "@/components/ui/dialog";
import { Button, cx, EmptyState, Input, PageHeader, Select } from "@/components/ui/primitives";
import { MoreMenu, type MoreMenuItem } from "@/components/ui/more-menu";
import { ORDER_STATUS_LABELS, ORDER_STATUSES } from "@/domain/labels";
import type { ID, OrderStatus, ServiceOrder } from "@/domain/types";
import { addDays, dateOf, formatDate, formatOrderNumber, formatPlate, todayISO } from "@/lib/format";
import { canChangeStatus, orderTotals } from "@/services/orders";
import { useMoveOrder } from "./move-order";
import { useOrderActions } from "./order-actions";
import { MechanicStrip, OrderPeek, PartDragPreview } from "./order-peek";
import { usePref } from "@/lib/prefs";
import { QuickOrderAction } from "./quick-order-action";
import { orderTotalText, PaymentBadge, vehicleLabel } from "./shared";

const COLUMN_ACCENT: Record<OrderStatus, string> = {
  waiting: "kanban-waiting",
  in_progress: "kanban-active",
  done: "kanban-done",
};

/**
 * Alvos pequenos (chips de mecânico) precisam do ponteiro, não do retângulo do
 * cartão arrastado. Pelo teclado não há ponteiro: usa a sobreposição.
 */
const collision: CollisionDetection = (args) => {
  const byPointer = pointerWithin(args);
  return byPointer.length ? byPointer : rectIntersection(args);
};

/** OS aberta no painel lateral (espiar). */
const PeekContext = createContext<{ peekId: ID | null; setPeek: (id: ID | null) => void }>({ peekId: null, setPeek: () => {} });

function OrderCard({ order, draggable, overlay }: { order: ServiceOrder; draggable: boolean; overlay?: boolean }) {
  const { db, view, user, online, customerOf, vehicleOf, userOf, openOrder } = useApp();
  const moveOrder = useMoveOrder();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: order.id, data: { type: "order" }, disabled: !draggable || overlay });
  const { peekId, setPeek } = useContext(PeekContext);
  const selected = peekId === order.id;
  const vehicle = vehicleOf(order.vehicleId);
  const totals = orderTotals(view, order);
  const number = formatOrderNumber(order.number);
  const ctx = { workshopId: order.workshopId, userId: user.id };
  const targets = ORDER_STATUSES.filter((s) => s !== order.status && canChangeStatus(db, ctx, order.status, s));

  const customer = customerOf(order.customerId)?.name;
  const mechanic = userOf(order.mechanicId)?.name.split(" ").slice(0, 2).join(" ") ?? "Sem responsável";
  const menuItems: MoreMenuItem[] = [
    { label: "Abrir completo", icon: <ExternalLink className="size-4" />, onSelect: () => openOrder(order.id) },
    ...targets.map((s, i) => ({
      label: ORDER_STATUS_LABELS[s],
      group: i === 0 ? "Mover para" : undefined,
      icon: <ArrowRight className="size-4" />,
      disabled: !online,
      onSelect: () => moveOrder(order, s),
    })),
  ];

  // Cartão enxuto (referência: Linear/GitHub Projects): identificação, cliente, veículo e
  // serviço; uma ação principal visível; mover e detalhes no menu "⋯". Clicar no cartão abre a OS.
  return (
    <article
      ref={overlay ? undefined : setNodeRef}
      data-order-id={overlay ? undefined : order.id}
      className={cx(
        "order-card order-card-compact rounded-md border border-line bg-surface text-sm",
        selected && !overlay && "is-selected",
        !overlay && "order-enter",
        isDragging && !overlay && "opacity-40",
        overlay && "rotate-1 shadow-xl",
      )}
    >
      <div className="flex items-start gap-1">
        {draggable && (
          <button
            type="button"
            className="-ml-1.5 flex h-6 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-ink active:cursor-grabbing"
            aria-label={`Arrastar ${number}`}
            {...listeners}
            {...attributes}
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
        )}
        <button type="button" className="min-w-0 flex-1 rounded text-left" aria-label={`Ver ${number}, ${customer}, no painel ao lado`} aria-expanded={selected} onClick={() => setPeek(selected ? null : order.id)} onDoubleClick={() => openOrder(order.id)}>
          <span className="flex items-baseline justify-between gap-2">
            <span className="shrink-0 font-semibold whitespace-nowrap text-primary">{number}</span>
            <span className="text-right font-semibold tabular-nums">{orderTotalText(totals)}</span>
          </span>
          <span className="mt-0.5 block truncate font-medium">{customer}</span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted">
            <span className="truncate">{vehicleLabel(vehicle)}</span>
            <span className="vehicle-plate shrink-0">{vehicle ? formatPlate(vehicle.plate) : ""}</span>
          </span>
          <span className="mt-1.5 block truncate" title={order.description}>{order.description}</span>
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <PaymentBadge order={order} />
        <span className="flex min-w-0 flex-1 items-center gap-1 text-xs text-muted">
          <User className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{mechanic}</span>
          <span className="shrink-0">· {formatDate(order.openedAt).slice(0, 5)}</span>
        </span>
      </div>
      {!overlay && (
        <div className="order-card-actions">
          <MoreMenu label={`Mais ações de ${number}`} items={menuItems} />
          <QuickOrderAction order={order} />
        </div>
      )}
    </article>
  );
}

function Column({ status, orders, canDrag, filtered }: { status: OrderStatus; orders: ServiceOrder[]; canDrag: boolean; filtered: boolean }) {
  const { setNodeRef, isOver, active } = useDroppable({ id: status, data: { type: "status" } });
  const draggingOrder = active?.data.current?.type === "order";
  return (
    <section
      ref={setNodeRef}
      aria-label={`${ORDER_STATUS_LABELS[status]}: ${orders.length} OS`}
      className={cx(
        "kanban-column flex min-h-64 flex-col rounded-xl border border-line bg-slate-100/70",
        COLUMN_ACCENT[status],
        isOver && draggingOrder && "ring-2 ring-primary/50",
      )}
    >
      <header className="flex items-center justify-between px-3 py-2">
        <h2 className="text-sm font-semibold">{ORDER_STATUS_LABELS[status]}</h2>
        <span className="rounded bg-surface px-2 py-0.5 text-xs font-semibold text-muted tabular-nums">{orders.length}</span>
      </header>
      <div className="flex max-h-[calc(100vh-390px)] min-h-40 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {orders.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted">{filtered ? "Nenhuma OS encontrada com os filtros atuais." : "Nenhuma OS nesta etapa."}</p>
        ) : (
          orders.map((o) => <OrderCard key={o.id} order={o} draggable={canDrag} />)
        )}
      </div>
    </section>
  );
}

const PERIODS = [
  { value: "all", label: "Qualquer data de abertura" },
  { value: "0", label: "Abertas hoje" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
];

export function OrdersPage() {
  const { view, can, online, customerOf, vehicleOf, openOrder, openNewOrder, membership, user } = useApp();
  const moveOrder = useMoveOrder();
  const [search, setSearch] = useState("");
  const [mechanic, setMechanic] = useState("");
  const [period, setPeriod] = useState("all");
  const [dragging, setDragging] = useState<{ type: "order"; order: ServiceOrder } | { type: "part"; partId: ID } | null>(null);
  const [peekId, setPeek] = useState<ID | null>(null);
  const [peekWidth, setPeekWidth] = usePref<number>(`os-peek-width:${membership.workshopId}:${user.id}`, 400);
  const { assign, addPart } = useOrderActions();
  const [showCancelled, setShowCancelled] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));

  const active = view.orders.filter((o) => !o.cancelledAt);
  const cancelled = view.orders.filter((o) => o.cancelledAt);
  const filtered = search.trim() !== "" || mechanic !== "" || period !== "all";

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qAlnum = q.replace(/[^a-z0-9]/g, "");
    const since = period === "all" ? null : addDays(todayISO(), -Number(period));
    return active
      .filter((o) => {
        if (mechanic === "none" ? o.mechanicId !== null : mechanic && o.mechanicId !== mechanic) return false;
        if (since && dateOf(o.openedAt) < since) return false;
        if (!q) return true;
        const v = vehicleOf(o.vehicleId);
        return (
          formatOrderNumber(o.number).toLowerCase().includes(q) ||
          String(o.number) === q ||
          (customerOf(o.customerId)?.name.toLowerCase().includes(q) ?? false) ||
          (qAlnum.length > 0 && (v?.plate.toLowerCase().includes(qAlnum) ?? false)) ||
          (v ? `${v.brand} ${v.model}`.toLowerCase().includes(q) : false)
        );
      })
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  }, [active, search, mechanic, period, customerOf, vehicleOf]);

  const canDrag = online && (can("os.status") || can("os.complete"));

  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as { type?: string; partId?: ID } | undefined;
    if (data?.type === "part" && data.partId) setDragging({ type: "part", partId: data.partId });
    else {
      const order = active.find((o) => o.id === e.active.id);
      setDragging(order ? { type: "order", order } : null);
    }
  };

  // Um só contexto de arraste: OS → etapa ou mecânico; peça → OS aberta no painel.
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const over = e.over ? String(e.over.id) : null;
    if (!over) return;
    const data = e.active.data.current as { type?: string; partId?: ID } | undefined;
    if (data?.type === "part") {
      const orderId = over.startsWith("os-parts:") ? over.slice(9) : null;
      const order = orderId ? view.orders.find((o) => o.id === orderId) : null;
      if (order && data.partId) addPart(order, data.partId);
      return;
    }
    const order = active.find((o) => o.id === e.active.id);
    if (!order) return;
    if (over.startsWith("mech:")) {
      const id = over.slice(5);
      assign(order, id === "none" ? null : id);
      return;
    }
    if ((ORDER_STATUSES as string[]).includes(over) && over !== order.status) moveOrder(order, over as OrderStatus);
  };

  // Ordem de leitura do quadro (coluna por coluna) para ↑ ↓ no painel.
  const reading = ORDER_STATUSES.flatMap((st) => visible.filter((o) => o.status === st));
  const peekOrder = peekId ? view.orders.find((o) => o.id === peekId) ?? null : null;
  const step = (dir: 1 | -1) => {
    if (!reading.length) return;
    const i = reading.findIndex((o) => o.id === peekId);
    const next = reading[(i + dir + reading.length) % reading.length];
    setPeek(next.id);
    document.querySelector(`[data-order-id="${next.id}"]`)?.scrollIntoView({ block: "nearest" });
  };

  return (
    <>
      <PageHeader
        title="Ordens de serviço"
        description="Clique no cartão para ver ao lado. Arraste para outra etapa ou até um responsável; no painel, arraste peças para dentro da OS."
        actions={
          <>
            {cancelled.length > 0 && (
              <Button onClick={() => setShowCancelled(true)}>Canceladas ({cancelled.length})</Button>
            )}
            {can("os.create") && (
              <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} disabled={!online} onClick={() => openNewOrder()}>
                Nova OS
              </Button>
            )}
          </>
        }
      />

      <div className="order-filters mb-4 flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface p-3">
        <div className="relative w-80">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-slate-400" aria-hidden />
          <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por número, cliente, placa ou veículo" aria-label="Buscar ordens de serviço" />
        </div>
        <Select className="w-64" value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Filtrar por período de abertura">
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </Select>
        {filtered && (
          <Button variant="ghost" onClick={() => { setSearch(""); setMechanic(""); setPeriod("all"); }}>
            Limpar filtros
          </Button>
        )}
      </div>

      <PeekContext.Provider value={{ peekId, setPeek }}>
      <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <MechanicStrip value={mechanic} onChange={setMechanic} />
      <div className="orders-workspace">
      <div className="min-w-0 flex-1">
      {active.length === 0 ? (
        <div className="rounded-md border border-line bg-surface">
          <EmptyState
            icon={<ClipboardList className="size-8" aria-hidden />}
            title="Nenhuma ordem de serviço ainda"
            description="Abra a primeira OS para começar a acompanhar os serviços da oficina."
            action={can("os.create") ? <Button variant="primary" disabled={!online} onClick={() => openNewOrder()}>Nova OS</Button> : undefined}
          />
        </div>
      ) : filtered && visible.length === 0 ? (
        <div className="rounded-md border border-line bg-surface">
          <EmptyState icon={<SearchX className="size-8" aria-hidden />} title="Nenhuma OS encontrada" description="Revise a busca ou limpe os filtros para ver todas as ordens." />
        </div>
      ) : (
        <div className="kanban-board grid grid-cols-3 gap-4">
          {ORDER_STATUSES.map((s) => (
            <Column key={s} status={s} orders={visible.filter((o) => o.status === s)} canDrag={canDrag} filtered={filtered} />
          ))}
        </div>
      )}

      </div>
      {peekOrder && <OrderPeek key={peekOrder.id} order={peekOrder} width={peekWidth} onWidth={setPeekWidth} onClose={() => setPeek(null)} onStep={step} />}
      </div>
      <DragOverlay dropAnimation={null}>
        {dragging?.type === "order" && <OrderCard order={dragging.order} draggable overlay />}
        {dragging?.type === "part" && <PartDragPreview partId={dragging.partId} />}
      </DragOverlay>
      </DndContext>
      </PeekContext.Provider>

      {showCancelled && (
        <Dialog title="Ordens canceladas" subtitle="Canceladas ficam fora do quadro, disponíveis apenas para consulta." onClose={() => setShowCancelled(false)}>
          <table className="data-table">
            <thead>
              <tr><th>OS</th><th>Cliente</th><th>Veículo</th><th>Cancelada em</th><th>Motivo</th></tr>
            </thead>
            <tbody>
              {cancelled.map((o) => (
                <tr key={o.id}>
                  <td>
                    <button type="button" className="font-semibold text-primary hover:underline" onClick={() => { setShowCancelled(false); openOrder(o.id); }}>
                      {formatOrderNumber(o.number)}
                    </button>
                  </td>
                  <td>{customerOf(o.customerId)?.name}</td>
                  <td>{vehicleLabel(vehicleOf(o.vehicleId))}</td>
                  <td>{formatDate(o.cancelledAt!)}</td>
                  <td>{o.cancelReason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Dialog>
      )}
    </>
  );
}
