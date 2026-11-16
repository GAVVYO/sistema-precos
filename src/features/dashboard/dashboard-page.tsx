"use client";

import { CalendarDays, CalendarPlus, CheckCircle2, CircleDollarSign, PackageCheck, Plus, Wrench } from "lucide-react";
import Link from "next/link";
import { ReactNode, useState } from "react";
import { useApp } from "@/app-state/app-context";
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, Stat, type Tone } from "@/components/ui/primitives";
import { useWidgetPrefs, type Widget, WidgetGrid, WidgetGridToolbar, type WidgetPrefs } from "@/components/ui/widget-grid";
import { APPOINTMENT_STATUS_LABELS, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/domain/labels";
import { ROLE_LABELS } from "@/domain/permissions";
import type { ServiceOrder } from "@/domain/types";
import { PaymentDialog } from "@/features/orders/order-dialogs";
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
  if (orders.length === 0) return <EmptyState icon={<Wrench className="size-7" aria-hidden />} title={empty} />;
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr><th>OS</th><th>Cliente</th><th>Veículo</th><th>Placa</th><th>Serviço</th><th>Responsável</th><th>Status</th><th>Abertura</th></tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const v = vehicleOf(o.vehicleId);
            return (
              <tr key={o.id}>
                <td><OrderLink order={o} /></td>
                <td>{customerOf(o.customerId)?.name}</td>
                <td>{vehicleLabel(v)}</td>
                <td className="font-mono text-xs">{v ? formatPlate(v.plate) : "—"}</td>
                <td className="max-w-56 truncate" title={o.description}>{o.description}</td>
                <td>{userOf(o.mechanicId)?.name.split(" ").slice(0, 2).join(" ") ?? <span className="text-muted">A definir</span>}</td>
                <td><StatusBadge order={o} /></td>
                <td className="whitespace-nowrap">{dateOf(o.openedAt) === todayISO() ? `Hoje, ${formatTime(o.openedAt)}` : formatDateTime(o.openedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TodayAgenda({ className }: { className?: string }) {
  const { view, userOf } = useApp();
  const today = todayISO();
  const list = view.appointments.filter((a) => a.date === today && a.status !== "cancelled").sort((a, b) => a.time.localeCompare(b.time));
  return (
    <Card className={className}>
      <CardHeader title="Agenda de hoje" subtitle={`${list.length} ${list.length === 1 ? "atendimento previsto" : "atendimentos previstos"}`} actions={<Link href="/agenda" className="text-xs font-medium text-primary hover:underline">Ver agenda</Link>} />
      {list.length === 0 ? (
        <EmptyState icon={<CalendarDays className="size-7" aria-hidden />} title="Nenhum agendamento para hoje" />
      ) : (
        <ul className="divide-y divide-line">
          {list.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-2 text-[13px]">
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

function StockAlerts({ className }: { className?: string }) {
  const { view } = useApp();
  const low = view.parts.filter((p) => partSituation(p) !== "ok").sort((a, b) => a.quantity - b.quantity);
  return (
    <Card className={className}>
      <CardHeader title="Alertas de estoque" subtitle="Peças abaixo ou no limite mínimo" actions={<Link href="/estoque" className="text-xs font-medium text-primary hover:underline">Ver estoque</Link>} />
      {low.length === 0 ? (
        <EmptyState icon={<PackageCheck className="size-7" aria-hidden />} title="Estoque em dia" description="Nenhuma peça abaixo da quantidade mínima." />
      ) : (
        <ul className="divide-y divide-line">
          {low.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2 text-[13px]">
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

function RecentActivity({ className }: { className?: string }) {
  const { view, userOf, openOrder } = useApp();
  const relevant = view.orderEvents
    .filter((e) => /^(OS aberta|Status alterado para Concluído|Pagamento|OS cancelada)/.test(e.message))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);
  return (
    <Card className={className}>
      <CardHeader title="Atividade recente" />
      {relevant.length === 0 ? (
        <EmptyState title="Nenhuma atividade registrada" />
      ) : (
        <ul className="divide-y divide-line">
          {relevant.map((e) => {
            const order = view.orders.find((o) => o.id === e.orderId);
            return (
              <li key={e.id} className="px-4 py-2 text-[13px]">
                <button type="button" className="font-semibold text-primary hover:underline" onClick={() => order && openOrder(order.id)}>
                  {order ? formatOrderNumber(order.number) : "OS"}
                </button>{" "}
                {e.message.replace(/^OS aberta\.$/, "aberta.").replace(/^Status alterado para Concluído\.$/, "concluída.").replace(/^OS cancelada/, "cancelada")}
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
  const widgets = useOperationalWidgets();
  return <WidgetGrid prefs={prefs} widgets={widgets} editing={editing} />;
}

const W = "h-full rounded-none border-0";

function useOperationalWidgets(): Widget[] {
  const { view, can, settings } = useApp();
  const today = todayISO();
  const active = view.orders.filter((o) => !o.cancelledAt);
  const open = active.filter((o) => o.status !== "done").sort((a, b) => a.openedAt.localeCompare(b.openedAt));
  const doneToday = active.filter((o) => o.status === "done" && o.completedAt && dateOf(o.completedAt) === today).length;
  const doneWeek = active.filter((o) => o.status === "done" && o.completedAt && dateOf(o.completedAt) >= addDays(today, -6)).length;
  const lowStock = view.parts.filter((p) => partSituation(p) !== "ok").length;
  const todayAppointments = view.appointments.filter((a) => a.date === today && a.status !== "cancelled").length;
  const showStock = can("stock.view") && settings.activeModules.includes("stock");
  const showAgenda = can("schedule.manage") && settings.activeModules.includes("schedule");
  const stat = (id: string, x: number, label: string, value: ReactNode, opts: { tone?: Tone; hint?: string } = {}): Widget => ({
    id,
    title: label,
    layout: { x, y: 0, w: 2, h: 2, minW: 2, minH: 2 },
    render: () => <Stat className={W} label={label} value={value} {...opts} />,
  });

  const list: (Widget | false)[] = [
    stat("stat-waiting", 0, "Ordens aguardando", open.filter((o) => o.status === "waiting").length, { tone: "warning" }),
    stat("stat-progress", 2, "Ordens em andamento", open.filter((o) => o.status === "in_progress").length),
    stat("stat-done", 4, "Ordens concluídas", doneWeek, { hint: `${doneToday} hoje · últimos 7 dias`, tone: "success" }),
    stat("stat-vehicles", 6, "Veículos com serviço aberto", new Set(open.map((o) => o.vehicleId)).size),
    showAgenda && stat("stat-agenda", 8, "Agendamentos do dia", todayAppointments),
    showStock && stat("stat-stock", 10, "Peças com estoque baixo", lowStock, { tone: lowStock ? "danger" : "neutral" }),
    {
      id: "open-orders",
      title: "Serviços em andamento",
      layout: { x: 0, y: 2, w: 8, h: 9, minW: 4, minH: 4 },
      render: () => (
        <Card className={W}>
          <CardHeader title="Serviços em andamento" subtitle="Ordens aguardando ou em execução" actions={<Link href="/ordens" className="text-xs font-medium text-primary hover:underline">Abrir quadro</Link>} />
          <OpenOrdersTable orders={open} empty="Nenhum serviço aberto no momento" />
        </Card>
      ),
    },
    showAgenda && { id: "today-agenda", title: "Agenda de hoje", layout: { x: 8, y: 2, w: 4, h: 5, minW: 3, minH: 3 }, render: () => <TodayAgenda className={W} /> },
    showStock && { id: "stock-alerts", title: "Alertas de estoque", layout: { x: 8, y: 7, w: 4, h: 6, minW: 3, minH: 3 }, render: () => <StockAlerts className={W} /> },
    { id: "activity", title: "Atividade recente", layout: { x: 0, y: 11, w: 8, h: 6, minW: 3, minH: 3 }, render: () => <RecentActivity className={W} /> },
  ];
  return list.filter((w): w is Widget => w !== false);
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
        <Stat label="Concluídas hoje" value={doneToday.length} tone="success" />
      </div>
      <Card>
        <CardHeader title="Meus serviços" subtitle="Ordens atribuídas a você" />
        {open.length === 0 ? (
          <EmptyState icon={<CheckCircle2 className="size-7" aria-hidden />} title="Nenhum serviço pendente" description="Quando uma OS for atribuída a você, ela aparece aqui." />
        ) : (
          <ul className="divide-y divide-line">
            {open.map((o) => {
              const v = vehicleOf(o.vehicleId);
              const next = o.status === "waiting" ? "in_progress" : "done";
              const allowed = next === "done" ? can("os.complete") : can("os.status") || can("os.complete");
              return (
                <li key={o.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-[13px]">
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
                      onClick={() => act((d, c) => changeOrderStatus(d, c, o.id, next), `${formatOrderNumber(o.number)} movida para ${ORDER_STATUS_LABELS[next]}.`)}
                    >
                      {next === "in_progress" ? "Iniciar serviço" : "Concluir serviço"}
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

  const widgets: Widget[] = [
    { id: "fin-received", title: "Recebido no mês", layout: { x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2 }, render: () => <Stat className={W} label="Recebido no mês" value={formatBRL(summary.receivedCents)} tone="success" /> },
    { id: "fin-expenses", title: "Despesas pagas no mês", layout: { x: 3, y: 0, w: 3, h: 2, minW: 2, minH: 2 }, render: () => <Stat className={W} label="Despesas pagas no mês" value={formatBRL(summary.expensesCents)} tone="danger" /> },
    { id: "fin-receivable", title: "Contas a receber", layout: { x: 6, y: 0, w: 3, h: 2, minW: 2, minH: 2 }, render: () => <Stat className={W} label="Contas a receber" value={formatBRL(summary.receivableCents)} tone="warning" hint={`${receivables.length} em aberto`} /> },
    { id: "fin-result", title: "Resultado de caixa do mês", layout: { x: 9, y: 0, w: 3, h: 2, minW: 2, minH: 2 }, render: () => <Stat className={W} label="Resultado de caixa do mês" value={formatBRL(summary.cashResultCents)} hint="Recebido − despesas pagas" /> },
    {
      id: "fin-receivables",
      title: "Contas a receber (lista)",
      layout: { x: 0, y: 2, w: 6, h: 9, minW: 4, minH: 4 },
      render: () => (
        <Card className={W}>
          <CardHeader title="Contas a receber" actions={<Link href="/financeiro" className="text-xs font-medium text-primary hover:underline">Ver financeiro</Link>} />
          {receivables.length === 0 ? (
            <EmptyState icon={<CircleDollarSign className="size-7" aria-hidden />} title="Nada a receber" description="Todos os serviços concluídos estão pagos." />
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
      id: "fin-recent",
      title: "Últimas movimentações",
      layout: { x: 6, y: 2, w: 6, h: 9, minW: 4, minH: 4 },
      render: () => (
        <Card className={W}>
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
      <WidgetGrid prefs={prefs} widgets={widgets} editing={editing} />
      {payOrder && <PaymentDialog orderId={payOrder} onClose={() => setPayOrder(null)} />}
    </>
  );
}

export function DashboardPage() {
  const { user, membership, can, online, settings, openNewOrder } = useApp();
  const today = todayISO();
  const variant =
    membership.role === "mechanic" ? "mechanic" : membership.role === "financial" && can("finance.view") ? "finance" : can("os.view") ? "operational" : "none";
  const [editing, setEditing] = useState(false);
  const prefs = useWidgetPrefs(`painel:${variant}:${membership.workshopId}:${user.id}`);
  const customizable = variant === "operational" || variant === "finance";

  return (
    <>
      <PageHeader
        title={`Olá, ${user.name.split(" ")[0]}`}
        description={`${weekdayName(today)}, ${formatDate(today)} · ${ROLE_LABELS[membership.role]} · ${settings.displayName}`}
        actions={
          <>
            {customizable && (
              <WidgetGridToolbar prefs={prefs} editing={editing} onEditingChange={setEditing} />
            )}
            {!editing && can("schedule.manage") && settings.activeModules.includes("schedule") && (
              <Link href="/agenda?novo=1" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-3.5 text-[13px] font-medium hover:bg-slate-50">
                <CalendarPlus className="size-4" aria-hidden />
                Novo agendamento
              </Link>
            )}
            {!editing && can("os.create") && settings.activeModules.includes("orders") && (
              <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} disabled={!online} onClick={() => openNewOrder()}>
                Nova OS
              </Button>
            )}
          </>
        }
      />
      {editing && (
        <p className="mb-2 text-[13px] text-muted" role="status">
          Arraste os blocos pela barra azul e redimensione pelo canto inferior direito. As setas e os botões − / + fazem o mesmo pelo teclado.
        </p>
      )}
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
