"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, CalendarPlus, CarFront, CheckCircle2, CircleDollarSign, Clock3, PackageCheck, Wrench } from "lucide-react";
import Link from "next/link";
import { ReactNode, useState } from "react";
import { useApp } from "@/app-state/app-context";
import { Badge, Button, Card, CardHeader, EmptyState, Input, PageHeader, Stat } from "@/components/ui/primitives";
import { ReadableText } from "@/components/accessibility/accessibility-controls";
import { MetricCard } from "@/components/ui/metric-card";
import { useWidgetPrefs, type Widget, WidgetGrid, WidgetGridToolbar, type WidgetPrefs } from "@/components/ui/widget-grid";
import { APPOINTMENT_STATUS_LABELS, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/domain/labels";
import type { ServiceOrder } from "@/domain/types";
import { PaymentDialog } from "@/features/orders/order-dialogs";
import { QuickOrderAction } from "@/features/orders/quick-order-action";
import { StatusBadge, vehicleLabel } from "@/features/orders/shared";
import {
  addDays, dateOf, formatBRL, formatDate, formatDateTime, formatOrderNumber, formatPlate, formatTime, startOfMonth, todayISO, weekdayName,
} from "@/lib/format";
import { financeSummary, listReceivables } from "@/services/finance";
import { changeOrderStatus } from "@/services/orders";
import { partSituation } from "@/services/stock";

function OrderLink({ order }: { order: ServiceOrder }) {
  const { openOrder } = useApp();
  return (
    <button type="button" className="font-semibold whitespace-nowrap text-primary hover:underline" onClick={() => openOrder(order.id)}>
      {formatOrderNumber(order.number)}
    </button>
  );
}

function OpenOrdersTable({ orders, empty }: { orders: ServiceOrder[]; empty: string }) {
  const { customerOf, vehicleOf, userOf } = useApp();
  const [sort, setSort] = useState<{ key: "openedAt" | "customer" | "service" | "status"; desc: boolean }>({ key: "openedAt", desc: false });
  const columns = [
    { key: "openedAt", label: "Serviço / abertura" },
    { key: "customer", label: "Cliente / veículo" },
    { key: "service", label: "Serviço / responsável" },
    { key: "status", label: "Etapa" },
  ] as const;
  const value = (o: ServiceOrder): string => sort.key === "customer" ? customerOf(o.customerId)?.name ?? "" : sort.key === "service" ? o.description : sort.key === "status" ? ORDER_STATUS_LABELS[o.status] : o.openedAt;
  const sorted = [...orders].sort((a, b) => (sort.desc ? -1 : 1) * value(a).localeCompare(value(b), "pt-BR", { numeric: true }));
  if (orders.length === 0) return <EmptyState icon={<Wrench className="size-7" aria-hidden />} title={empty} />;
  return (
    <div className="overflow-x-auto">
      <table className="data-table service-table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} aria-sort={sort.key === c.key ? sort.desc ? "descending" : "ascending" : "none"}>
            <button type="button" className="inline-flex items-center gap-1.5 rounded hover:text-primary" onClick={() => setSort({ key: c.key, desc: sort.key === c.key ? !sort.desc : false })}>
              {c.label}{sort.key !== c.key ? <ArrowUpDown className="size-3 opacity-50" aria-hidden /> : sort.desc ? <ArrowDown className="size-3 text-primary" aria-hidden /> : <ArrowUp className="size-3 text-primary" aria-hidden />}
            </button>
          </th>)}<th className="text-right">Próxima ação</th></tr>
        </thead>
        <tbody>
          {sorted.map((o) => {
            const v = vehicleOf(o.vehicleId);
            return (
              <tr key={o.id}>
                <td className="whitespace-nowrap"><OrderLink order={o} /><span className="mt-1 block text-xs text-muted">{dateOf(o.openedAt) === todayISO() ? `Hoje, ${formatTime(o.openedAt)}` : formatDateTime(o.openedAt)}</span></td>
                <td><span className="block font-medium">{customerOf(o.customerId)?.name}</span><span className="mt-1 block text-xs text-muted">{vehicleLabel(v)} · <ReadableText label="placa" text={v ? formatPlate(v.plate) : "—"}><span className="vehicle-plate">{v ? formatPlate(v.plate) : "—"}</span></ReadableText></span></td>
                <td><span className="block max-w-72"><ReadableText label="descrição do serviço" text={o.description} /></span><span className="mt-1 block text-xs text-muted">{userOf(o.mechanicId)?.name ?? "Responsável a definir"}</span></td>
                <td><StatusBadge order={o} /></td>
                <td className="text-right"><QuickOrderAction order={o} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TodayAgenda() {
  const { view, userOf } = useApp();
  const today = todayISO();
  const list = view.appointments.filter((a) => a.date === today && a.status !== "cancelled").sort((a, b) => a.time.localeCompare(b.time));
  return (
    <Card>
      <CardHeader title="Agenda de hoje" subtitle={`${list.length} ${list.length === 1 ? "atendimento previsto" : "atendimentos previstos"}`} actions={<Link href="/agenda" className="text-sm font-medium text-primary hover:underline">Ver agenda</Link>} />
      {list.length === 0 ? (
        <EmptyState icon={<CalendarDays className="size-7" aria-hidden />} title="Nenhum agendamento para hoje" />
      ) : (
        <ul className="divide-y divide-line">
          {list.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className="w-11 font-semibold tabular-nums">{a.time}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{a.customerName} · {a.brand} {a.model}</span>
                <span className="block truncate text-xs text-muted">{a.service}{a.mechanicId ? ` · ${userOf(a.mechanicId)?.name.split(" ")[0]}` : ""}</span>
              </span>
              <Badge tone={a.status === "confirmed" ? "success" : a.status === "attended" ? "neutral" : "info"}>{APPOINTMENT_STATUS_LABELS[a.status]}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function StockAlerts() {
  const { view } = useApp();
  const low = view.parts.filter((p) => partSituation(p) !== "ok").sort((a, b) => a.quantity - b.quantity);
  return (
    <Card>
      <CardHeader title="Alertas de estoque" subtitle="Peças abaixo ou no limite mínimo" actions={<Link href="/estoque" className="text-sm font-medium text-primary hover:underline">Ver estoque</Link>} />
      {low.length === 0 ? (
        <EmptyState icon={<PackageCheck className="size-7" aria-hidden />} title="Estoque em dia" description="Nenhuma peça abaixo da quantidade mínima." />
      ) : (
        <ul className="divide-y divide-line">
          {low.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="text-xs text-muted">{p.code} · mínimo {p.minQuantity}</span>
              </span>
              <Badge tone={p.quantity <= 0 ? "danger" : "warning"}>{p.quantity <= 0 ? "Sem estoque" : `${p.quantity} em estoque`}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RecentActivity() {
  const { view, userOf, openOrder } = useApp();
  const relevant = view.orderEvents
    .filter((e) => /^(OS aberta|Serviço aberto|Status alterado para Concluído|Etapa mudou para Pronto|Pagamento|OS cancelada|Serviço cancelado)/.test(e.message))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);
  return (
    <Card>
      <CardHeader title="Atividade recente" />
      {relevant.length === 0 ? (
        <EmptyState title="Nenhuma atividade registrada" />
      ) : (
        <ul className="activity-feed divide-y divide-line">
          {relevant.map((e) => {
            const order = view.orders.find((o) => o.id === e.orderId);
            return (
              <li key={e.id} className="relative py-2.5 pr-4 pl-9 text-sm"><span className="activity-dot" aria-hidden />
                <button type="button" className="font-semibold text-primary hover:underline" onClick={() => order && openOrder(order.id)}>
                  {order ? formatOrderNumber(order.number) : "Serviço"}
                </button>{" "}
                {e.message.replace(/^(OS aberta|Serviço aberto)\.$/, "aberto.").replace(/^(Status alterado para Concluído|Etapa mudou para Pronto)\.$/, "está pronto.").replace(/^(OS cancelada|Serviço cancelado)/, "cancelado")}
                <span className="block text-xs text-muted">{formatDateTime(e.at)} · {userOf(e.userId)?.name ?? "Usuário"}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function OperationalDashboard({ editing, prefs }: { editing: boolean; prefs: WidgetPrefs }) {
  const { view, can, settings } = useApp();
  const [filter, setFilter] = useState<"open" | "waiting" | "in_progress" | "receivable" | "done">("open");
  const [search, setSearch] = useState("");
  const { customerOf, vehicleOf } = useApp();
  const today = todayISO();
  const active = view.orders.filter((o) => !o.cancelledAt);
  const open = active.filter((o) => o.status !== "done").sort((a, b) => a.openedAt.localeCompare(b.openedAt));
  const doneToday = active.filter((o) => o.status === "done" && o.completedAt && dateOf(o.completedAt) === today).length;
  const doneWeek = active.filter((o) => o.status === "done" && o.completedAt && dateOf(o.completedAt) >= addDays(today, -6)).length;
  const lowStock = view.parts.filter((p) => partSituation(p) !== "ok").length;
  const todayAppointments = view.appointments.filter((a) => a.date === today && a.status !== "cancelled").length;
  const showStock = can("stock.view") && settings.activeModules.includes("stock");
  const showAgenda = can("schedule.manage") && settings.activeModules.includes("schedule");
  const receivable = listReceivables(view).flatMap((r) => r.order ? [r.order] : []);
  const source = filter === "receivable" ? receivable : filter === "done" ? active.filter((o) => o.status === "done" && o.completedAt && dateOf(o.completedAt) >= addDays(today, -6)) : filter === "open" ? open : open.filter((o) => o.status === filter);
  const visible = source.filter((o) => {
    const v = vehicleOf(o.vehicleId);
    const text = `${formatOrderNumber(o.number)} ${customerOf(o.customerId)?.name ?? ""} ${vehicleLabel(v)} ${v?.plate ?? ""} ${v ? formatPlate(v.plate) : ""}`;
    return text.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR").trim());
  });

  const metric = (id: string, x: number, node: ReactNode, title: string): Widget => ({ id, title, layout: { x, y: 0, w: 3, h: 3, minW: 2, minH: 3 }, render: () => node });
  const widgets: Widget[] = [
    metric("m-waiting", 0, <MetricCard onSelect={() => setFilter("waiting")} selected={filter === "waiting"} appearance="waiting" icon={<Clock3 />} label="Serviços aguardando" value={open.filter((o) => o.status === "waiting").length} note="Na fila" footer={<>Serviços abertos: <strong>{open.length}</strong></>} />, "Serviços aguardando"),
    metric("m-progress", 3, <MetricCard onSelect={() => setFilter("in_progress")} selected={filter === "in_progress"} appearance="active" icon={<Wrench />} label="Serviços em andamento" value={open.filter((o) => o.status === "in_progress").length} note="Sendo feitos" footer={<>Responsáveis: <strong>{new Set(open.filter((o) => o.status === "in_progress" && o.mechanicId).map((o) => o.mechanicId)).size}</strong></>} />, "Serviços em andamento"),
    metric("m-done", 6, <MetricCard onSelect={() => setFilter("done")} selected={filter === "done"} appearance="done" icon={<CheckCircle2 />} label="Serviços prontos" value={doneWeek} note={`${doneToday} hoje`} footer={<>Período: <strong>últimos 7 dias</strong></>} />, "Serviços prontos"),
    metric("m-vehicles", 9, <MetricCard onSelect={() => setFilter("open")} selected={filter === "open"} appearance="neutral" icon={<CarFront />} label="Carros na oficina" value={new Set(open.map((o) => o.vehicleId)).size} footer={<>Com serviço <strong>em aberto</strong></>} />, "Carros na oficina"),
    {
      id: "services",
      title: "Serviços da oficina",
      layout: { x: 0, y: 3, w: 9, h: 11, minW: 5, minH: 5 },
      render: () => (
        <Card>
          <CardHeader title="Serviços da oficina" subtitle={`${open.length} em aberto · acompanhe a próxima etapa`} actions={<Link href="/ordens" className="text-sm font-semibold text-primary hover:underline">Abrir quadro →</Link>} />
          <div className="work-filter" role="group" aria-label="Filtrar serviços do início">
            <button type="button" aria-pressed={filter === "open"} onClick={() => setFilter("open")}>Em aberto</button>
            <button type="button" aria-pressed={filter === "waiting"} onClick={() => setFilter("waiting")}>Aguardando</button>
            <button type="button" aria-pressed={filter === "in_progress"} onClick={() => setFilter("in_progress")}>Em andamento</button>
            {(can("finance.view") || can("finance.payment")) && <button type="button" aria-pressed={filter === "receivable"} onClick={() => setFilter("receivable")}>A receber ({receivable.length})</button>}
            <button type="button" aria-pressed={filter === "done"} onClick={() => setFilter("done")}>Prontos</button>
            <Input aria-label="Buscar serviços do início" placeholder="Placa ou nome do cliente" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <OpenOrdersTable orders={visible} empty={search ? "Nenhum serviço com essa placa ou nome. Confira o que foi digitado." : "Nenhum serviço nesta situação."} />
        </Card>
      ),
    },
    { id: "activity", title: "Atividade recente", layout: { x: 0, y: 14, w: 9, h: 7, minW: 3, minH: 3 }, render: () => <RecentActivity /> },
    ...(showAgenda ? [{ id: "agenda", title: "Agenda de hoje", layout: { x: 9, y: 3, w: 3, h: 7, minW: 3, minH: 3 }, render: () => <TodayAgenda /> }] : []),
    ...(showStock ? [{ id: "stock", title: "Alertas de estoque", layout: { x: 9, y: 10, w: 3, h: 9, minW: 3, minH: 3 }, render: () => <StockAlerts /> }] : []),
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 py-1 text-sm text-muted">
        {showAgenda && <span>Agendamentos do dia <strong className="ml-1 text-ink tabular-nums">{todayAppointments}</strong></span>}
        {showStock && <span>Peças com estoque baixo <strong className={`ml-1 tabular-nums ${lowStock ? "text-danger" : "text-ink"}`}>{lowStock}</strong></span>}
      </div>
      <WidgetGrid prefs={prefs} editing={editing} widgets={widgets} />
    </>
  );
}

function MechanicDashboard() {
  const { view, user, act, can, online } = useApp();
  const today = todayISO();
  const mine = view.orders.filter((o) => !o.cancelledAt && o.mechanicId === user.id);
  const open = mine.filter((o) => o.status !== "done").sort((a, b) => a.openedAt.localeCompare(b.openedAt));
  const doneToday = mine.filter((o) => o.status === "done" && o.completedAt && dateOf(o.completedAt) === today);
  const { customerOf, vehicleOf, openOrder } = useApp();

  return (
    <>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Aguardando você" value={open.filter((o) => o.status === "waiting").length} tone="warning" />
        <Stat label="Em andamento" value={open.filter((o) => o.status === "in_progress").length} />
        <Stat label="Prontos hoje" value={doneToday.length} tone="success" />
      </div>
      <Card>
        <CardHeader title="Meus serviços" subtitle="Serviços com você como responsável" />
        {open.length === 0 ? (
          <EmptyState icon={<CheckCircle2 className="size-7" aria-hidden />} title="Nenhum serviço pendente" description="Quando um serviço for passado para você, ele aparece aqui." />
        ) : (
          <ul className="divide-y divide-line">
            {open.map((o) => {
              const v = vehicleOf(o.vehicleId);
              const next = o.status === "waiting" ? "in_progress" : "done";
              const allowed = next === "done" ? can("os.complete") : can("os.status") || can("os.complete");
              return (
                <li key={o.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p><OrderLink order={o} /> <StatusBadge order={o} /></p>
                    <p className="mt-0.5 font-medium">{o.description}</p>
                    <p className="text-xs text-muted">{vehicleLabel(v)} · {v ? formatPlate(v.plate) : ""} · {customerOf(o.customerId)?.name}</p>
                  </div>
                  <Button onClick={() => openOrder(o.id)}>Ver detalhes e peças</Button>
                  {allowed && (
                    <Button
                      variant="primary"
                      disabled={!online}
                      onClick={() => act((d, c) => changeOrderStatus(d, c, o.id, next), `${formatOrderNumber(o.number)} movido para ${ORDER_STATUS_LABELS[next]}.`)}
                    >
                      {next === "in_progress" ? "Começar" : "Marcar como pronto"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

function FinanceDashboard({ editing, prefs }: { editing: boolean; prefs: WidgetPrefs }) {
  const { view, customerOf, can, online } = useApp();
  const [payOrder, setPayOrder] = useState<string | null>(null);
  const today = todayISO();
  const summary = financeSummary(view, startOfMonth(today), today);
  const receivables = listReceivables(view);
  const recent = view.transactions.filter((t) => t.status === "paid").sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  const stat = (id: string, x: number, title: string, node: ReactNode): Widget => ({ id, title, layout: { x, y: 0, w: 3, h: 2, minW: 2, minH: 2 }, render: () => node });
  const widgets: Widget[] = [
    stat("f-received", 0, "Recebido no mês", <Stat label="Recebido no mês" value={formatBRL(summary.receivedCents)} tone="success" />),
    stat("f-expenses", 3, "Despesas pagas no mês", <Stat label="Despesas pagas no mês" value={formatBRL(summary.expensesCents)} tone="danger" />),
    stat("f-receivable", 6, "Contas a receber", <Stat label="Contas a receber" value={formatBRL(summary.receivableCents)} tone="warning" hint={`${receivables.length} em aberto`} />),
    stat("f-result", 9, "Sobrou no caixa no mês", <Stat label="Sobrou no caixa no mês" value={formatBRL(summary.cashResultCents)} hint="Recebido − despesas pagas" />),
    {
      id: "f-receivables",
      title: "Lista de contas a receber",
      layout: { x: 0, y: 2, w: 6, h: 10, minW: 4, minH: 4 },
      render: () => (
        <Card>
          <CardHeader title="Contas a receber" actions={<Link href="/financeiro" className="text-sm font-medium text-primary hover:underline">Ver financeiro</Link>} />
          {receivables.length === 0 ? (
            <EmptyState icon={<CircleDollarSign className="size-7" aria-hidden />} title="Nada a receber" description="Todos os serviços prontos já foram pagos." />
          ) : (
            <table className="data-table">
              <thead><tr><th>Origem</th><th>Cliente</th><th className="num">Valor</th><th /></tr></thead>
              <tbody>
                {receivables.map((r) => (
                  <tr key={r.key}>
                    <td>{r.order ? <OrderLink order={r.order} /> : r.transaction?.description}</td>
                    <td>{customerOf(r.customerId)?.name ?? "—"}</td>
                    <td className="num">{formatBRL(r.amountCents)}</td>
                    <td className="text-right">
                      {r.order && can("finance.payment") && (
                        <Button size="sm" disabled={!online} onClick={() => setPayOrder(r.order!.id)}>Registrar pagamento</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      ),
    },
    {
      id: "f-moves",
      title: "Últimas movimentações",
      layout: { x: 6, y: 2, w: 6, h: 10, minW: 4, minH: 4 },
      render: () => (
        <Card>
          <CardHeader title="Últimas movimentações" />
          <table className="data-table">
            <thead><tr><th>Data</th><th>Descrição</th><th>Forma</th><th className="num">Valor</th></tr></thead>
            <tbody>
              {recent.map((t) => (
                <tr key={t.id}>
                  <td>{formatDate(t.date)}</td>
                  <td>{t.description}</td>
                  <td>{PAYMENT_METHOD_LABELS[t.method]}</td>
                  <td className={`num font-medium ${t.kind === "income" ? "text-success" : "text-danger"}`}>{t.kind === "income" ? "+" : "−"} {formatBRL(t.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ),
    },
  ];

  return (
    <>
      <WidgetGrid prefs={prefs} editing={editing} widgets={widgets} />
      {payOrder && <PaymentDialog orderId={payOrder} onClose={() => setPayOrder(null)} />}
    </>
  );
}

export function DashboardPage() {
  const { user, membership, can, settings } = useApp();
  const today = todayISO();
  const variant =
    membership.role === "mechanic" ? "mechanic" : membership.role === "financial" && can("finance.view") ? "finance" : can("os.view") ? "operational" : "none";
  const [editing, setEditing] = useState(false);
  const prefs = useWidgetPrefs(`${variant}:${membership.workshopId}:${user.id}`);
  const customizable = variant === "operational" || variant === "finance";

  return (
    <>
      <PageHeader
        title={membership.role === "mechanic" ? `Meus serviços, ${user.name.split(" ")[0]}` : "Atendimento"}
        description={`${weekdayName(today)}, ${formatDate(today)}`}
        actions={
          <>
            {customizable && <WidgetGridToolbar prefs={prefs} editing={editing} onEditingChange={setEditing} />}
            {!editing && can("schedule.manage") && settings.activeModules.includes("schedule") && (
              <Link href="/agenda?novo=1" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-3.5 text-sm font-medium hover:bg-slate-50">
                <CalendarPlus className="size-4" aria-hidden />
                Novo agendamento
              </Link>
            )}
          </>
        }
      />
      {variant === "mechanic" && <MechanicDashboard />}
      {variant === "finance" && <FinanceDashboard editing={editing} prefs={prefs} />}
      {variant === "operational" && <OperationalDashboard editing={editing} prefs={prefs} />}
      {variant === "none" && (
        <Card>
          <EmptyState title="Nada para exibir" description="Seu usuário ainda não possui permissões para os módulos desta oficina. Fale com o proprietário." />
        </Card>
      )}
    </>
  );
}
