"use client";

import { CalendarPlus, CircleDollarSign } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ReactNode, useState } from "react";
import { useApp } from "@/app-state/app-context";
import { Button, Card, CardHeader, EmptyState, PageHeader, Stat } from "@/components/ui/primitives";
import { useWidgetPrefs, type Widget, WidgetGrid, WidgetGridToolbar, type WidgetPrefs } from "@/components/ui/widget-grid";
import { PAYMENT_METHOD_LABELS } from "@/domain/labels";
import type { ServiceOrder } from "@/domain/types";
import { PaymentDialog } from "@/features/orders/order-dialogs";
import { formatBRL, formatDate, formatOrderNumber, startOfMonth, todayISO, weekdayName } from "@/lib/format";
import { financeSummary, listReceivables } from "@/services/finance";
import { TodayPanel, TodayRail } from "./today-panel";
import { MechanicYard, useYard, Yard } from "./yard";

function OrderLink({ order }: { order: ServiceOrder }) {
  const { openOrder } = useApp();
  return (
    <button type="button" className="font-semibold whitespace-nowrap text-primary hover:underline" onClick={() => openOrder(order.id)}>
      {formatOrderNumber(order.number)}
    </button>
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
    stat("f-received", 0, "Recebido no mês", <Stat label="Recebido no mês" value={summary.receivedCents} format={formatBRL} tone="success" />),
    stat("f-expenses", 3, "Despesas pagas no mês", <Stat label="Despesas pagas no mês" value={summary.expensesCents} format={formatBRL} tone="danger" />),
    stat("f-receivable", 6, "Contas a receber", <Stat label="Contas a receber" value={summary.receivableCents} format={formatBRL} tone="warning" hint={`${receivables.length} em aberto`} />),
    stat("f-result", 9, "Sobrou no caixa no mês", <Stat label="Sobrou no caixa no mês" value={summary.cashResultCents} format={formatBRL} hint="Recebido − despesas pagas" />),
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
                        <Button size="sm" variant="primary" disabled={!online} onClick={() => setPayOrder(r.order!.id)}>Receber</Button>
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
  // "Organizar tela inicial" (só no painel do financeiro) fica no menu da conta e chega aqui por ?organizar=1.
  const params = useSearchParams();
  const router = useRouter();
  const editing = params.has("organizar") && variant === "finance";
  const setEditing = (on: boolean) => router.replace(on ? "/inicio?organizar=1" : "/inicio", { scroll: false });
  const prefs = useWidgetPrefs(`${variant}:${membership.workshopId}:${user.id}`);
  const yard = useYard();
  const ready = yard.ready.length;
  const day = `${weekdayName(today)}, ${formatDate(today).slice(0, 5)}`;
  const summary =
    variant === "operational"
      ? `${day} · ${yard.count === 0 ? "nenhum carro na oficina" : `${yard.count} ${yard.count === 1 ? "carro" : "carros"} na oficina`}${ready ? ` · ${ready} ${ready === 1 ? "pronto" : "prontos"} esperando o cliente` : ""}`
      : `${weekdayName(today)}, ${formatDate(today)}`;

  return (
    <>
      <PageHeader
        title={membership.role === "mechanic" ? `Seus carros, ${user.name.split(" ")[0]}` : "Hoje"}
        description={summary}
        actions={
          <>
            {variant === "finance" && <WidgetGridToolbar prefs={prefs} editing={editing} onEditingChange={setEditing} />}
            {!editing && can("schedule.manage") && settings.activeModules.includes("schedule") && (
              <Link href="/agenda?novo=1" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-3.5 text-sm font-medium hover:bg-slate-50">
                <CalendarPlus className="size-4" aria-hidden />
                Novo agendamento
              </Link>
            )}
          </>
        }
      />
      {variant === "operational" && (
        <div className="hoje-layout">
          <Yard />
          <TodayRail />
        </div>
      )}
      {variant === "mechanic" && <MechanicYard />}
      {variant === "finance" && !editing && <TodayPanel />}
      {variant === "finance" && <FinanceDashboard editing={editing} prefs={prefs} />}
      {variant === "none" && (
        <Card>
          <EmptyState title="Nada para exibir" description="Seu usuário ainda não possui permissões para os módulos desta oficina. Fale com o proprietário." />
        </Card>
      )}
    </>
  );
}
