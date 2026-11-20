"use client";

import { CalendarPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/app-state/app-context";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { PAYMENT_METHOD_LABELS } from "@/domain/labels";
import type { Cents, FinancialTransaction } from "@/domain/types";
import { SettleDialog } from "@/features/finance/finance-page";
import { PaymentDialog } from "@/features/orders/order-dialogs";
import { vehicleLabel } from "@/features/orders/shared";
import { formatBRL, formatDate, monthName, startOfMonth, todayISO, weekdayName } from "@/lib/format";
import { financeSummary, listReceivables } from "@/services/finance";
import { TodayRail } from "./today-panel";
import { MechanicYard, useYard, Yard } from "./yard";

/**
 * Hoje do perfil Financeiro (decisão 94), no padrão do Caixa: uma frase com o
 * mês, quem está devendo (com Receber) e o que entrou e saiu por último.
 */
function FinanceToday() {
  const { view, customerOf, vehicleOf, can, online } = useApp();
  const [payOrder, setPayOrder] = useState<string | null>(null);
  const [settle, setSettle] = useState<FinancialTransaction | null>(null);
  const today = todayISO();
  const summary = financeSummary(view, startOfMonth(today), today);
  const receivables = listReceivables(view);
  const owed = receivables.reduce((s, r) => s + r.amountCents, 0);
  const recent = view.transactions.filter((t) => t.status === "paid").sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const result = summary.receivedCents - summary.expensesCents;
  const month = monthName(today).split(" ")[0];

  return (
    <div className="cash">
      <p className="cash-say">
        Em {month} entrou <strong>{formatBRL(summary.receivedCents)}</strong> e saiu <strong data-tone="out">{formatBRL(summary.expensesCents)}</strong>:{" "}
        <strong data-tone={result < 0 ? "down" : "up"}>{result < 0 ? `faltou ${formatBRL(-result as Cents)}` : `sobrou ${formatBRL(result as Cents)}`}</strong>.
      </p>
      <div className="cash-two">
        <section className="cash-card" aria-labelledby="ft-due">
          <h2 id="ft-due" className="cash-h2">Quem está devendo</h2>
          <p className="cash-hint">{receivables.length ? `${formatBRL(owed as Cents)} de ${receivables.length} ${receivables.length === 1 ? "cliente" : "clientes"}` : "Ninguém. Todos os serviços prontos foram pagos."}</p>
          {receivables.length > 0 && (
            <ul className="cash-list">
              {receivables.slice(0, 6).map((r, i) => {
                const name = customerOf(r.customerId)?.name ?? "Cliente";
                const v = r.order ? vehicleOf(r.order.vehicleId) : undefined;
                const days = Math.max(0, Math.round((Date.parse(today) - Date.parse(r.since)) / 86_400_000));
                return (
                  <li key={r.key} className="cash-row" style={{ "--i": i } as React.CSSProperties}>
                    <PersonAvatar name={name} size={40} />
                    <span className="cash-row-main">
                      <b>{name}</b>
                      <small>{r.order ? `${v ? `${vehicleLabel(v)} · ` : ""}pronto ${days === 0 ? "hoje" : days === 1 ? "ontem" : `há ${days} dias`}` : r.transaction?.description}</small>
                    </span>
                    <span className="cash-amt is-due">{formatBRL(r.amountCents)}</span>
                    {can("finance.payment") && <Button variant="primary" className="rounded-full" disabled={!online} onClick={() => (r.order ? setPayOrder(r.order.id) : r.transaction && setSettle(r.transaction))}>Receber</Button>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="cash-card" aria-labelledby="ft-moves">
          <h2 id="ft-moves" className="cash-h2">O que entrou e saiu por último</h2>
          <ul className="cash-list">
            {recent.map((t, i) => (
              <li key={t.id} className="cash-row" style={{ "--i": i } as React.CSSProperties}>
                <span className="cash-row-main">
                  <b>{t.kind === "income" ? customerOf(t.customerId)?.name ?? t.description : t.description}</b>
                  <small>{formatDate(t.date)} · {PAYMENT_METHOD_LABELS[t.method]}{t.kind === "expense" ? ` · ${t.category}` : ""}</small>
                </span>
                <span className={`cash-amt ${t.kind === "income" ? "is-in" : "is-out"}`}>{t.kind === "income" ? "+" : "−"} {formatBRL(t.amountCents)}</span>
              </li>
            ))}
          </ul>
          <Link href="/financeiro" className="cash-link">Ver o Financeiro →</Link>
        </section>
      </div>
      {payOrder && <PaymentDialog orderId={payOrder} onClose={() => setPayOrder(null)} />}
      {settle && <SettleDialog tx={settle} onClose={() => setSettle(null)} />}
    </div>
  );
}

export function DashboardPage() {
  const { user, membership, can, settings } = useApp();
  const today = todayISO();
  const variant =
    membership.role === "mechanic" ? "mechanic" : membership.role === "financial" && can("finance.view") ? "finance" : can("os.view") ? "operational" : "none";
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
            {can("schedule.manage") && settings.activeModules.includes("schedule") && (
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
      {variant === "finance" && <FinanceToday />}
      {variant === "none" && (
        <Card>
          <EmptyState title="Nada para exibir" description="Seu usuário ainda não possui permissões para os módulos desta oficina. Fale com o proprietário." />
        </Card>
      )}
    </>
  );
}
