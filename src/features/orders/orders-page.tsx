"use client";

import { vtName } from "@/lib/view-transition";
import { isBorn, ORDER_CLOSED_EVENT, takeBorn } from "@/lib/born";
import { CountUp } from "@/components/ui/count-up";
import { GuidedTour, IllusDrag, IllusSequence, IllusTap, IllusTyping } from "@/components/ui/guided-tour";
import {
  CollisionDetection, DndContext, DragEndEvent, pointerWithin, rectIntersection, DragOverlay, DragStartEvent, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { ArrowRight, Check, CheckCircle2, CheckSquare, ClipboardList, Clock3, ExternalLink, GripVertical, Inbox, Search, SearchX, SlidersHorizontal, User, UserCheck, Wrench } from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useApp } from "@/app-state/app-context";
import { Dialog } from "@/components/ui/dialog";
import { Button, cx, EmptyState, PageHeader } from "@/components/ui/primitives";
import { ChoiceGroup } from "@/components/ui/choice";
import { MoreMenu, type MoreMenuItem } from "@/components/ui/more-menu";
import { TrayDock, useTray } from "@/components/layout/tray";
import { ORDER_STATUS_LABELS, ORDER_STATUSES } from "@/domain/labels";
import type { ID, OrderStatus, ServiceOrder } from "@/domain/types";
import { addDays, dateOf, formatDate, formatOrderNumber, todayISO } from "@/lib/format";
import { canChangeStatus, orderTotals, paymentSituation } from "@/services/orders";
import { useMoveOrder } from "./move-order";
import { useOrderActions } from "./order-actions";
import { MechanicStrip, OrderPeek, PartDragPreview } from "./order-peek";
import { usePref } from "@/lib/prefs";
import { QuickOrderAction } from "./quick-order-action";
import { orderTotalText, vehicleLabel } from "./shared";
import { MiniPlate, sinceShop } from "@/features/dashboard/yard";


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

  // Serviço recém-aberto "nasce" no quadro quando aparece de fato (sem janela por cima).
  useEffect(() => {
    if (overlay || !isBorn(order.id)) return;
    const play = () => {
      if (document.querySelector("dialog[open]") || !takeBorn(order.id)) return;
      const el = document.querySelector<HTMLElement>(`.svc-list [data-order-id="${order.id}"]`);
      if (!el) return;
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      el.classList.add("just-born");
      window.setTimeout(() => el.classList.remove("just-born"), 1400);
    };
    const t = window.setTimeout(play, 120);
    window.addEventListener(ORDER_CLOSED_EVENT, play);
    return () => { window.clearTimeout(t); window.removeEventListener(ORDER_CLOSED_EVENT, play); };
  }, [order.id, overlay]);
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
    { label: "Ver serviço completo", icon: <ExternalLink className="size-4" />, onSelect: () => openOrder(order.id) },
    { label: isPicked ? "Desmarcar" : "Marcar para mexer em vários", icon: <CheckSquare className="size-4" />, onSelect: () => togglePick(order.id) },
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

  // Linha larga (referências: Apple Mail/Lembretes, Linear): placa desenhada, carro e cliente,
  // o serviço e uma ação principal. Arrastar, selecionar e "⋯" aparecem ao passar o mouse.
  return (
    <article
      ref={overlay ? undefined : setNodeRef}
      data-order-id={overlay ? undefined : order.id}
      data-tour={overlay ? undefined : "card"}
      data-status={order.status}
      style={overlay ? undefined : ({ ["--vt" as string]: vtName("card", order.id) })}
      className={cx(
        "order-card svc-row",
        selected && !overlay && "is-selected",
        isPicked && !overlay && "is-picked",
        !overlay && "order-enter",
        isDragging && !overlay && "opacity-40",
        overlay && "is-overlay",
      )}
    >
      {!overlay && (
        <button type="button" className="pick-box" aria-pressed={isPicked} aria-label={`${isPicked ? "Tirar" : "Incluir"} ${number} na seleção`} title="Selecionar (X, ou Ctrl/⌘+clique)" onClick={() => togglePick(order.id)}>
          {isPicked && <Check className="size-3.5" aria-hidden />}
        </button>
      )}
      {draggable && (
        <button type="button" className="svc-grip" aria-label={`Arrastar ${number}`} title="Arraste para outra etapa (nas abas) ou para um responsável" data-tour="drag" {...listeners} {...attributes}>
          <GripVertical className="size-4" aria-hidden />
        </button>
      )}
      <button type="button" className="svc-open" aria-label={`Ver ${number}, ${customer}, no painel ao lado`} aria-expanded={selected} onClick={(e) => {
          if (e.ctrlKey || e.metaKey || e.shiftKey) togglePick(order.id);
          else setPeek(selected ? null : order.id);
        }}
        onKeyDown={(e) => {
          if (e.key.toLowerCase() === "x" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); togglePick(order.id); }
        }}
        onDoubleClick={() => openOrder(order.id)}>
        <MiniPlate plate={vehicle?.plate} />
        <span className="svc-main">
          <span className="svc-car">{vehicleLabel(vehicle)} <span className="svc-owner">· <strong>{customer}</strong></span></span>
          <span className="svc-what" title={order.description}>{order.description}</span>
          <span className="svc-meta">
            <span className="svc-number">{number}</span>
            <span><User className="size-3.5" aria-hidden />{mechanic}</span>
            <span>{order.status === "done" && order.completedAt ? `Pronto ${sinceDay(order.completedAt)}` : sinceShop(order.openedAt)}</span>
          </span>
        </span>
      </button>
      <span className="svc-money">
        <span className="svc-value">{orderTotalText(totals)}</span>
      </span>
      {!overlay && (
        <span className="svc-actions">
          <QuickOrderAction order={order} size="md" />
          <MoreMenu label={`Mais ações de ${number}`} items={menuItems} />
        </span>
      )}
    </article>
  );
}

function sinceDay(at: string): string {
  const d = dateOf(at);
  const today = todayISO();
  return d === today ? "hoje" : d === addDays(today, -1) ? "ontem" : `em ${formatDate(d).slice(0, 5)}`;
}

const STAGE_META: Record<OrderStatus, { label: string; empty: string; emptyText: string; icon: typeof Clock3 }> = {
  waiting: { label: "Aguardando", empty: "Nenhum carro esperando", emptyText: "Quando um carro chegar, ele entra aqui até alguém começar.", icon: Clock3 },
  in_progress: { label: "Em andamento", empty: "Nenhum carro sendo feito", emptyText: "Clique em Começar num carro de Aguardando.", icon: Wrench },
  done: { label: "Pronto", empty: "Nenhum carro pronto", emptyText: "Quando terminar um serviço, clique em Marcar como pronto.", icon: CheckCircle2 },
};

/** Aba grande de etapa (controle segmentado, à la Apple). Também recebe cartões arrastados. */
function StageTab({ status, count, sub, active, onSelect, onKey }: { status: OrderStatus; count: number; sub: string; active: boolean; onSelect: () => void; onKey: (e: React.KeyboardEvent) => void }) {
  const { setNodeRef, isOver, active: dragging } = useDroppable({ id: status, data: { type: "status" } });
  const Icon = STAGE_META[status].icon;
  return (
    <button
      ref={setNodeRef}
      type="button"
      role="tab"
      id={`stage-tab-${status}`}
      aria-selected={active}
      aria-controls="stage-panel"
      tabIndex={active ? 0 : -1}
      data-stage={status}
      data-over={(isOver && dragging?.data.current?.type === "order") || undefined}
      className="stage-tab"
      onClick={onSelect}
      onKeyDown={onKey}
    >
      <span className="stage-tab-icon" aria-hidden><Icon /></span>
      <span className="stage-tab-text">
        <span className="stage-tab-label">{STAGE_META[status].label}</span>
        <span className="stage-tab-sub">{sub}</span>
      </span>
      <span className="stage-tab-count"><CountUp value={count} /></span>
    </button>
  );
}

function StageEmpty({ status, filtered }: { status: OrderStatus; filtered: boolean }) {
  const Icon = STAGE_META[status].icon;
  return (
    <div className="stage-empty" data-stage={status}>
      <span className="stage-empty-art" aria-hidden><Icon /></span>
      <p className="stage-empty-title">{filtered ? "Nada encontrado nesta etapa" : STAGE_META[status].empty}</p>
      <p className="stage-empty-text">{filtered ? "Confira a busca ou os filtros." : STAGE_META[status].emptyText}</p>
    </div>
  );
}

const PERIODS = [
  { value: "all", label: "Qualquer dia" },
  { value: "0", label: "Hoje" },
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
  const [stagePref, setStagePref] = usePref<OrderStatus>(`os-stage:${membership.workshopId}:${user.id}`, "waiting");
  // Serviço recém-aberto: abre na etapa dele para o "nascimento" aparecer.
  const [stageOverride, setStageOverride] = useState<OrderStatus | null>(() => view.orders.find((o) => isBorn(o.id))?.status ?? null);
  const stage = stageOverride ?? stagePref;
  const setStage = (st: OrderStatus) => { setStageOverride(null); setStagePref(st); setPeek(null); };
  const [showOlder, setShowOlder] = useState(false);
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
      .sort((a, b) => (a.status === "done" ? (b.completedAt ?? b.openedAt).localeCompare(a.completedAt ?? a.openedAt) : a.openedAt.localeCompare(b.openedAt)));
  }, [active, search, mechanic, period, customerOf, vehicleOf]);
  const inStage = (st: OrderStatus) => visible.filter((o) => o.status === st);
  const stageOrders = inStage(stage);
  const owing = stage === "done" ? stageOrders.filter((o) => paymentSituation(o, orderTotals(view, o)) === "pending") : [];
  const settled = stage === "done" ? stageOrders.filter((o) => !owing.includes(o)) : [];
  const elsewhere = filtered && stageOrders.length === 0 ? ORDER_STATUSES.find((st) => st !== stage && inStage(st).length > 0) : undefined;
  const subOf = (st: OrderStatus) => {
    const list = inStage(st);
    if (st === "done") { const n = list.filter((o) => paymentSituation(o, orderTotals(view, o)) === "pending").length; return n ? `${n} falta${n === 1 ? "" : "m"} receber` : "todos pagos"; }
    if (st === "waiting") { const n = list.filter((o) => !o.mechanicId).length; return n ? `${n} sem ninguém` : "todos com alguém"; }
    const n = new Set(list.map((o) => o.mechanicId).filter(Boolean)).size;
    return n === 0 ? "ninguém fazendo" : n === 1 ? "1 mecânico" : `${n} mecânicos`;
  };
  const tabKey = (e: React.KeyboardEvent) => {
    const i = ORDER_STATUSES.indexOf(stage);
    const to = e.key === "ArrowRight" ? ORDER_STATUSES[(i + 1) % 3] : e.key === "ArrowLeft" ? ORDER_STATUSES[(i + 2) % 3] : e.key === "Home" ? ORDER_STATUSES[0] : e.key === "End" ? ORDER_STATUSES[2] : null;
    if (!to) return;
    e.preventDefault(); setStage(to);
    window.setTimeout(() => document.getElementById(`stage-tab-${to}`)?.focus(), 0);
  };

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
      else if (over !== group[0].status) moveOrder(group[0], over as OrderStatus, undefined, { animate: false });
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
  const reading = stageOrders;
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
        description="Uma etapa por vez. Clique no carro para ver os detalhes; o botão azul passa para a próxima etapa."
      />

      <div className="svc-toolbar">
        <label className="svc-search" data-tour="search-page">
          <Search className="size-4" aria-hidden />
          <span className="sr-only">Buscar serviços</span>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Placa, nome do cliente ou nº do serviço" />
        </label>
        <details className="svc-filter">
          <summary>
            <SlidersHorizontal className="size-4" aria-hidden />Filtrar
            {(mechanic || period !== "all") && <span className="svc-filter-on">{[mechanic === "none" ? "Sem responsável" : mechanics.find((m) => m.id === mechanic)?.name.split(" ")[0], PERIODS.find((p) => p.value === period && p.value !== "all")?.label].filter(Boolean).join(" · ")}</span>}
          </summary>
          <div className="svc-filter-body">
            <ChoiceGroup label="Aberto quando?" value={period} onChange={setPeriod} options={PERIODS} />
            <div>
              <p className="choice-legend">Quem está fazendo?</p>
              <MechanicStrip value={mechanic} onChange={setMechanic} />
            </div>
            {cancelled.length > 0 && <button type="button" className="svc-cancelled" onClick={() => setShowCancelled(true)}>Ver serviços cancelados ({cancelled.length}) →</button>}
          </div>
        </details>
        {filtered && (
          <Button variant="ghost" onClick={() => { setSearch(""); setMechanic(""); setPeriod("all"); }}>
            Limpar
          </Button>
        )}
      </div>

      {active.length > 0 && (
        <GuidedTour
          id="quadro"
          steps={[
            {
              target: "[data-tour=search-page]",
              title: "Ache o carro pela placa ou pelo nome",
              body: <p>Digite aqui a placa (ou o nome do cliente) para encontrar o serviço na hora.</p>,
              illustration: <IllusTyping text="QRT4J58" />,
            },
            {
              target: ".stage-tabs",
              title: "Uma tela para cada etapa",
              body: <p>Toque em <strong>Aguardando</strong>, <strong>Em andamento</strong> ou <strong>Pronto</strong> para ver só os carros daquela etapa. O número mostra quantos tem.</p>,
              illustration: <IllusSequence items={["Aguardando", "Em andamento", "Pronto"]} />,
            },
            {
              target: ".svc-list [data-tour=next-step]",
              title: "Este botão faz o próximo passo",
              body: <p>Cada carro passa por Aguardando, Em andamento e Pronto. O botão do cartão muda sozinho: <strong>Começar</strong>, depois <strong>Marcar como pronto</strong> e, no fim, <strong>Receber</strong>.</p>,
              illustration: <IllusSequence items={["Começar", "Marcar como pronto", "Receber"]} />,
            },
            {
              target: ".svc-list [data-tour=card]",
              title: "Clique no carro para ver tudo",
              body: <p>Abre o resumo ao lado: cliente, telefone, peças e valor. Lá você lança as peças usadas.</p>,
              illustration: <IllusTap label="Serviço nº 11" />,
            },
            {
              target: ".svc-list [data-tour=drag]",
              title: "Se preferir, arraste",
              body: <><p>Segure nos pontinhos e solte o carro numa das abas de etapa lá em cima.</p><p className="tour-note">É só um atalho: os botões fazem a mesma coisa.</p></>,
              illustration: <IllusDrag />,
            },
            {
              target: "[data-tour=new-order]",
              title: "Carro chegou? Comece aqui",
              body: <p>Clique em <strong>Novo serviço</strong>, digite a placa e o que o cliente pediu.</p>,
              illustration: <IllusTap label="+ Novo serviço" />,
            },
          ]}
        />
      )}

      <PeekContext.Provider value={{ peekId, setPeek, picked, togglePick }}>
      <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      {pickedOrders.length > 0 && (
        <div className="pick-bar" role="region" aria-label="Serviços selecionados">
          <strong>{pickedOrders.length} {pickedOrders.length === 1 ? "serviço selecionado" : "serviços selecionados"}</strong>
          <span className="text-muted">Escolha o que fazer com eles (ou arraste um para levar todos).</span>
          <span className="ml-auto flex flex-wrap items-center gap-2">
            <MoreMenu text="Mover para" label="Mover selecionados para" items={ORDER_STATUSES.map((st, i) => ({ label: ORDER_STATUS_LABELS[st], group: i === 0 ? "Mover para" : undefined, icon: <ArrowRight className="size-4" />, disabled: !online, onSelect: () => { moveMany(pickedOrders, st); setPicked(new Set()); } }))} />
            {can("os.edit") && (
              <MoreMenu text="Passar para" label="Passar selecionados para" items={[...mechanics.map((m, i) => ({ label: m.name, group: i === 0 ? "Passar para" : undefined, icon: <UserCheck className="size-4" />, disabled: !online, onSelect: () => { assignMany(pickedOrders, m.id); setPicked(new Set()); } })), { label: "Sem responsável", icon: <UserCheck className="size-4" />, disabled: !online, onSelect: () => { assignMany(pickedOrders, null); setPicked(new Set()); } }]} />
            )}
            <Button size="sm" icon={<Inbox className="size-4" aria-hidden />} onClick={() => { tray.add(pickedOrders.map((o) => ({ type: "order" as const, id: o.id }))); setPicked(new Set()); }}>Guardar na bandeja</Button>
            <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>Desmarcar todos</Button>
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
          <EmptyState
            icon={<SearchX className="size-8" aria-hidden />}
            title="Nenhum serviço encontrado"
            description="Confira a placa ou o nome. Se o carro ainda não tem serviço, abra um novo."
            action={<div className="flex flex-wrap justify-center gap-2"><Button onClick={() => { setSearch(""); setMechanic(""); setPeriod("all"); }}>Limpar busca</Button>{can("os.create") && <Button variant="primary" disabled={!online} onClick={() => openNewOrder()}>Novo serviço</Button>}</div>}
          />
        </div>
      ) : (
        <div className="svc-stage" data-stage={stage}>
          <div className="stage-tabs" role="tablist" aria-label="Etapas do serviço">
            {ORDER_STATUSES.map((st) => (
              <StageTab key={st} status={st} count={inStage(st).length} sub={subOf(st)} active={stage === st} onSelect={() => setStage(st)} onKey={tabKey} />
            ))}
          </div>
          <div id="stage-panel" role="tabpanel" aria-labelledby={`stage-tab-${stage}`} className="svc-list" data-stage={stage}>
            {stageOrders.length === 0 ? (
              <>
                <StageEmpty status={stage} filtered={filtered} />
                {elsewhere && <p className="svc-elsewhere">Achamos {inStage(elsewhere).length} em <button type="button" onClick={() => setStage(elsewhere)}>{STAGE_META[elsewhere].label} →</button></p>}
              </>
            ) : stage === "done" ? (
              <>
                {owing.length > 0 && (
                  <section aria-label="Prontos que faltam receber">
                    <h2 className="svc-group">Falta receber <span>{owing.length}</span></h2>
                    <div className="svc-rows">{owing.map((o) => <OrderCard key={o.id} order={o} draggable={canDrag} />)}</div>
                  </section>
                )}
                {settled.length > 0 && (
                  <section aria-label="Prontos e pagos">
                    <h2 className="svc-group">Pagos e entregues <span>{settled.length}</span></h2>
                    <div className="svc-rows">{(showOlder ? settled : settled.slice(0, 6)).map((o) => <OrderCard key={o.id} order={o} draggable={canDrag} />)}</div>
                    {settled.length > 6 && !showOlder && <Button variant="ghost" className="mt-2" onClick={() => setShowOlder(true)}>Mostrar mais {settled.length - 6}</Button>}
                  </section>
                )}
              </>
            ) : (
              <div className="svc-rows">{stageOrders.map((o) => <OrderCard key={o.id} order={o} draggable={canDrag} />)}</div>
            )}
          </div>
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
