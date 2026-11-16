"use client";

import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { ClipboardList, GripVertical, Plus, Search, SearchX, User } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "@/app-state/app-context";
import { Dialog } from "@/components/ui/dialog";
import { Button, cx, EmptyState, Input, PageHeader, Select } from "@/components/ui/primitives";
import { ORDER_STATUS_LABELS, ORDER_STATUSES } from "@/domain/labels";
import type { OrderStatus, ServiceOrder } from "@/domain/types";
import { addDays, dateOf, formatDate, formatOrderNumber, formatPlate, todayISO } from "@/lib/format";
import { canChangeStatus, changeOrderStatus, orderTotals } from "@/services/orders";
import { QuickOrderAction } from "./quick-order-action";
import { orderTotalText, PaymentBadge, vehicleLabel } from "./shared";

const COLUMN_ACCENT: Record<OrderStatus, string> = {
  waiting: "kanban-waiting",
  in_progress: "kanban-active",
  done: "kanban-done",
};

function OrderCard({ order, draggable, overlay }: { order: ServiceOrder; draggable: boolean; overlay?: boolean }) {
  const { db, view, user, online, act, customerOf, vehicleOf, userOf, openOrder } = useApp();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: order.id, disabled: !draggable || overlay });
  const vehicle = vehicleOf(order.vehicleId);
  const totals = orderTotals(view, order);
  const number = formatOrderNumber(order.number);
  const ctx = { workshopId: order.workshopId, userId: user.id };
  const targets = ORDER_STATUSES.filter((s) => s !== order.status && canChangeStatus(db, ctx, order.status, s));

  return (
    <article
      ref={overlay ? undefined : setNodeRef}
      className={cx(
        "order-card rounded-md border border-line bg-surface p-3 text-sm",
        !overlay && "order-enter",
        isDragging && !overlay && "opacity-40",
        overlay && "rotate-1 shadow-xl",
      )}
    >
      <div className="flex items-start gap-1.5">
        {draggable && (
          <button
            type="button"
            className="mt-0.5 -ml-1 cursor-grab touch-none rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-ink active:cursor-grabbing"
            aria-label={`Arrastar ${number}`}
            {...listeners}
            {...attributes}
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
        )}
        <button type="button" className="min-w-0 flex-1 rounded text-left" aria-label={`Abrir ${number}, ${customerOf(order.customerId)?.name}`} onClick={() => openOrder(order.id)}>
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <span className="font-semibold text-primary">{number}</span>
              <PaymentBadge order={order} />
            </span>
            <span className="font-semibold tabular-nums">{orderTotalText(totals)}</span>
          </div>
          <p className="mt-0.5 truncate font-medium">{customerOf(order.customerId)?.name}</p>
          <p className="mt-1 truncate text-xs text-muted">
            {vehicleLabel(vehicle)} · <span className="vehicle-plate">{vehicle ? formatPlate(vehicle.plate) : ""}</span>
          </p>
          <p className="mt-1 line-clamp-2 text-sm">{order.description}</p>
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2">
        <span className="flex min-w-0 items-center gap-1 text-xs text-muted">
          <User className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{userOf(order.mechanicId)?.name.split(" ").slice(0, 2).join(" ") ?? "Sem responsável"}</span>
          <span className="shrink-0">· {formatDate(order.openedAt).slice(0, 5)}</span>
        </span>
        {!overlay && targets.length > 0 && (
          <select
            className="h-9 w-[130px] shrink-0 rounded border border-transparent bg-slate-50 px-2 text-sm font-medium text-primary hover:border-line disabled:opacity-50"
            value=""
            disabled={!online}
            aria-label={`Mover ${number} para outra coluna`}
            onChange={(e) => {
              const next = e.target.value as OrderStatus;
              if (next) act((d, c) => changeOrderStatus(d, c, order.id, next), `${number} movida para ${ORDER_STATUS_LABELS[next]}.`);
            }}
          >
            <option value="">Mover para…</option>
            {targets.map((s) => (
              <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>
            ))}
          </select>
        )}
      </div>
      {!overlay && <div className="order-card-actions"><button type="button" className="text-sm font-semibold text-primary hover:underline" onClick={() => openOrder(order.id)}>Ver detalhes</button><QuickOrderAction order={order} /></div>}
    </article>
  );
}

function Column({ status, orders, canDrag, filtered }: { status: OrderStatus; orders: ServiceOrder[]; canDrag: boolean; filtered: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${ORDER_STATUS_LABELS[status]}: ${orders.length} OS`}
      className={cx(
        "kanban-column flex min-h-64 flex-col rounded-xl border border-line bg-slate-100/70",
        COLUMN_ACCENT[status],
        isOver && "ring-2 ring-primary/50",
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
  const { view, act, can, online, mechanics, customerOf, vehicleOf, openOrder, openNewOrder } = useApp();
  const [search, setSearch] = useState("");
  const [mechanic, setMechanic] = useState("");
  const [period, setPeriod] = useState("all");
  const [dragging, setDragging] = useState<ServiceOrder | null>(null);
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

  const onDragStart = (e: DragStartEvent) => setDragging(active.find((o) => o.id === e.active.id) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const order = active.find((o) => o.id === e.active.id);
    const target = e.over?.id as OrderStatus | undefined;
    if (!order || !target || target === order.status) return;
    act((d, c) => changeOrderStatus(d, c, order.id, target), `${formatOrderNumber(order.number)} movida para ${ORDER_STATUS_LABELS[target]}.`);
  };

  return (
    <>
      <PageHeader
        title="Ordens de serviço"
        description="Acompanhe cada serviço e execute a próxima etapa direto no cartão."
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

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface p-3">
        <div className="relative w-80">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-slate-400" aria-hidden />
          <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por número, cliente, placa ou veículo" aria-label="Buscar ordens de serviço" />
        </div>
        <Select className="w-56" value={mechanic} onChange={(e) => setMechanic(e.target.value)} aria-label="Filtrar por responsável">
          <option value="">Todos os responsáveis</option>
          {mechanics.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
          <option value="none">Sem responsável</option>
        </Select>
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
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
          <div className="kanban-board grid grid-cols-3 gap-4">
            {ORDER_STATUSES.map((s) => (
              <Column key={s} status={s} orders={visible.filter((o) => o.status === s)} canDrag={canDrag} filtered={filtered} />
            ))}
          </div>
          <DragOverlay>{dragging && <OrderCard order={dragging} draggable overlay />}</DragOverlay>
        </DndContext>
      )}

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
