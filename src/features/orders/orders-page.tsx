"use client";

import {
  CollisionDetection, DndContext, DragEndEvent, pointerWithin, rectIntersection, DragOverlay, DragStartEvent, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { ArrowRight, Check, CheckSquare, ClipboardList, ExternalLink, GripVertical, Inbox, Search, SearchX, User, UserCheck } from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useApp } from "@/app-state/app-context";
import { Dialog } from "@/components/ui/dialog";
import { Button, cx, EmptyState, Input, PageHeader, Select } from "@/components/ui/primitives";
import { MoreMenu, type MoreMenuItem } from "@/components/ui/more-menu";
import { TrayDock, useTray } from "@/components/layout/tray";
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
interface Board {
  peekId: ID | null;
  setPeek: (id: ID | null) => void;
  /** Seleção múltipla (Finder/Drive): Ctrl/⌘/Shift+clique ou tecla X. */
  picked: Set<ID>;
  togglePick: (id: ID) => void;
}
const PeekContext = createContext<Board>({ peekId: null, setPeek: () => {}, picked: new Set(), togglePick: () => {} });

function OrderCard({ order, draggable, overlay }: { order: ServiceOrder; draggable: boolean; overlay?: boolean }) {
  const { db, view, user, online, customerOf, vehicleOf, userOf, openOrder } = useApp();
  const moveOrder = useMoveOrder();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: order.id, data: { type: "order" }, disabled: !draggable || overlay });
  const { peekId, setPeek, picked, togglePick } = useContext(PeekContext);
  const tray = useTray();
  const selected = peekId === order.id;
  const isPicked = picked.has(order.id);
  const vehicle = vehicleOf(order.vehicleId);
  const totals = orderTotals(view, order);
  const number = formatOrderNumber(order.number);
  const ctx = { workshopId: order.workshopId, userId: user.id };
  const targets = ORDER_STATUSES.filter((s) => s !== order.status && canChangeStatus(db, ctx, order.status, s));

  const customer = customerOf(order.customerId)?.name;
  const mechanic = userOf(order.mechanicId)?.name.split(" ").slice(0, 2).join(" ") ?? "Sem responsável";
  const menuItems: MoreMenuItem[] = [
    { label: "Abrir completo", icon: <ExternalLink className="size-4" />, onSelect: () => openOrder(order.id) },
    { label: isPicked ? "Tirar da seleção" : "Selecionar (X)", icon: <CheckSquare className="size-4" />, onSelect: () => togglePick(order.id) },
    tray.has({ type: "order", id: order.id })
      ? { label: "Tirar da bandeja", icon: <Inbox className="size-4" />, onSelect: () => tray.remove({ type: "order", id: order.id }) }
      : { label: "Guardar na bandeja", icon: <Inbox className="size-4" />, onSelect: () => tray.add([{ type: "order", id: order.id }]) },
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
        isPicked && !overlay && "is-picked",
        !overlay && "order-enter",
        isDragging && !overlay && "opacity-40",
        overlay && "rotate-1 shadow-xl",
      )}
    >
      {!overlay && (
        <button type="button" className="pick-box" aria-pressed={isPicked} aria-label={`${isPicked ? "Tirar" : "Incluir"} ${number} na seleção`} title="Selecionar (X, ou Ctrl/⌘+clique)" onClick={() => togglePick(order.id)}>
          {isPicked && <Check className="size-3.5" aria-hidden />}
        </button>
      )}
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
        <button type="button" className="min-w-0 flex-1 rounded text-left" aria-label={`Ver ${number}, ${customer}, no painel ao lado`} aria-expanded={selected} onClick={(e) => {
            if (e.ctrlKey || e.metaKey || e.shiftKey) togglePick(order.id);
            else setPeek(selected ? null : order.id);
          }}
          onKeyDown={(e) => {
            if (e.key.toLowerCase() === "x" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); togglePick(order.id); }
          }}
          onDoubleClick={() => openOrder(order.id)}>
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
      aria-label={`${ORDER_STATUS_LABELS[status]}: ${orders.length} ${orders.length === 1 ? "serviço" : "serviços"}`}
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
          <p className="px-2 py-6 text-center text-xs text-muted">{filtered ? "Nenhum serviço encontrado com os filtros atuais." : "Nenhum serviço nesta etapa."}</p>
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
  const { view, can, online, mechanics, customerOf, vehicleOf, openOrder, openNewOrder, membership, user } = useApp();
  const moveOrder = useMoveOrder();
  const [search, setSearch] = useState("");
  const [mechanic, setMechanic] = useState("");
  const [period, setPeriod] = useState("all");
  const [dragging, setDragging] = useState<{ type: "order"; order: ServiceOrder } | { type: "part"; partId: ID } | null>(null);
  const [peekId, setPeek] = useState<ID | null>(null);
  const [picked, setPicked] = useState<Set<ID>>(new Set());
  const togglePick = (id: ID) => setPicked((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const tray = useTray();
  const { moveMany, assignMany } = useOrderActions();
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

  type DragData = { type?: string; partId?: ID; orderId?: ID; fromTray?: boolean } | undefined;
  const orderIdOf = (e: { active: { id: unknown; data: { current: unknown } } }) => (e.active.data.current as DragData)?.orderId ?? String(e.active.id);

  /** OS levadas no arraste: a seleção inteira, se o cartão arrastado fizer parte dela. */
  const groupFor = (id: ID) => (picked.has(id) && picked.size > 1 ? active.filter((o) => picked.has(o.id)) : active.filter((o) => o.id === id));

  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as DragData;
    if (data?.type === "part" && data.partId) setDragging({ type: "part", partId: data.partId });
    else {
      const order = active.find((o) => o.id === orderIdOf(e));
      setDragging(order ? { type: "order", order } : null);
    }
  };

  // Um só contexto de arraste: OS → etapa, responsável ou bandeja; peça → OS do painel ou bandeja.
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const over = e.over ? String(e.over.id) : null;
    if (!over) return;
    const data = e.active.data.current as DragData;
    const done = () => { if (data?.fromTray && over !== "tray") tray.remove(data.type === "part" ? { type: "part", id: data.partId! } : { type: "order", id: data.orderId! }); };
    if (data?.type === "part" && data.partId) {
      if (over === "tray") { tray.add([{ type: "part", id: data.partId }]); return; }
      const orderId = over.startsWith("os-parts:") ? over.slice(9) : null;
      const order = orderId ? view.orders.find((o) => o.id === orderId) : null;
      if (order) { addPart(order, data.partId); done(); }
      return;
    }
    const id = orderIdOf(e);
    const group = groupFor(id);
    if (!group.length) return;
    if (over === "tray") { tray.add(group.map((o) => ({ type: "order" as const, id: o.id }))); setPicked(new Set()); return; }
    if (over.startsWith("mech:")) {
      const mech = over.slice(5) === "none" ? null : over.slice(5);
      if (group.length > 1) assignMany(group, mech); else assign(group[0], mech);
      setPicked(new Set()); done();
      return;
    }
    if ((ORDER_STATUSES as string[]).includes(over)) {
      if (group.length > 1) moveMany(group, over as OrderStatus);
      else if (over !== group[0].status) moveOrder(group[0], over as OrderStatus);
      setPicked(new Set()); done();
    }
  };

  // Esc limpa a seleção (fora de campos e modais).
  useEffect(() => {
    if (!picked.size) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "Escape" && !document.querySelector("dialog[open]") && !["INPUT", "SELECT", "TEXTAREA"].includes(t.tagName)) setPicked(new Set());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picked]);
  const pickedOrders = active.filter((o) => picked.has(o.id));

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
        title="Serviços"
        description="Clique no cartão para ver os detalhes. Use o botão do cartão para passar para a próxima etapa."
        actions={
          <>
            {cancelled.length > 0 && (
              <Button onClick={() => setShowCancelled(true)}>Cancelados ({cancelled.length})</Button>
            )}
          </>
        }
      />

      <div className="order-filters mb-4 flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface p-3">
        <div className="relative w-80">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-slate-400" aria-hidden />
          <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar placa, nome do cliente ou nº do serviço" aria-label="Buscar serviços" />
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

      <PeekContext.Provider value={{ peekId, setPeek, picked, togglePick }}>
      <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <MechanicStrip value={mechanic} onChange={setMechanic} />
      {pickedOrders.length > 0 && (
        <div className="pick-bar" role="region" aria-label="Serviços selecionados">
          <strong>{pickedOrders.length} {pickedOrders.length === 1 ? "serviço selecionado" : "serviços selecionados"}</strong>
          <span className="text-muted">Arraste uma delas para levar todas.</span>
          <span className="ml-auto flex flex-wrap items-center gap-2">
            <MoreMenu text="Mover para" label="Mover selecionadas para" items={ORDER_STATUSES.map((st, i) => ({ label: ORDER_STATUS_LABELS[st], group: i === 0 ? "Mover para" : undefined, icon: <ArrowRight className="size-4" />, disabled: !online, onSelect: () => { moveMany(pickedOrders, st); setPicked(new Set()); } }))} />
            {can("os.edit") && (
              <MoreMenu text="Atribuir a" label="Atribuir selecionadas a" items={[...mechanics.map((m, i) => ({ label: m.name, group: i === 0 ? "Atribuir a" : undefined, icon: <UserCheck className="size-4" />, disabled: !online, onSelect: () => { assignMany(pickedOrders, m.id); setPicked(new Set()); } })), { label: "Sem responsável", icon: <UserCheck className="size-4" />, disabled: !online, onSelect: () => { assignMany(pickedOrders, null); setPicked(new Set()); } }]} />
            )}
            <Button size="sm" icon={<Inbox className="size-4" aria-hidden />} onClick={() => { tray.add(pickedOrders.map((o) => ({ type: "order" as const, id: o.id }))); setPicked(new Set()); }}>Guardar na bandeja</Button>
            <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>Limpar (Esc)</Button>
          </span>
        </div>
      )}
      <div className="orders-workspace">
      <div className="min-w-0 flex-1">
      {active.length === 0 ? (
        <div className="rounded-md border border-line bg-surface">
          <EmptyState
            icon={<ClipboardList className="size-8" aria-hidden />}
            title="Nenhum serviço ainda"
            description="Quando um carro chegar, clique em Novo serviço para começar."
            action={can("os.create") ? <Button variant="primary" disabled={!online} onClick={() => openNewOrder()}>Novo serviço</Button> : undefined}
          />
        </div>
      ) : filtered && visible.length === 0 ? (
        <div className="rounded-md border border-line bg-surface">
          <EmptyState icon={<SearchX className="size-8" aria-hidden />} title="Nenhum serviço encontrado" description="Confira a placa ou o nome, ou limpe a busca para ver todos." />
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
      <TrayDock dnd />
      <DragOverlay dropAnimation={null}>
        {dragging?.type === "order" && (
          <div className="relative">
            <OrderCard order={dragging.order} draggable overlay />
            {picked.has(dragging.order.id) && picked.size > 1 && <span className="drag-count" aria-hidden>{picked.size} serviços</span>}
          </div>
        )}
        {dragging?.type === "part" && <PartDragPreview partId={dragging.partId} />}
      </DragOverlay>
      </DndContext>
      </PeekContext.Provider>

      {showCancelled && (
        <Dialog title="Serviços cancelados" subtitle="Serviços cancelados ficam fora do quadro, só para consulta." onClose={() => setShowCancelled(false)}>
          <table className="data-table">
            <thead>
              <tr><th>Serviço</th><th>Cliente</th><th>Veículo</th><th>Cancelada em</th><th>Motivo</th></tr>
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
