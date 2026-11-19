"use client";

import {
  CaretLeft, CaretRight, ClockCountdown, Coins, Drop, Engine, Lightbulb, Receipt, Storefront, TrayArrowDown, TrayArrowUp, UsersThree, Wrench,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useApp } from "@/app-state/app-context";
import type { Period } from "@/components/ui/period";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Button } from "@/components/ui/primitives";
import { PAYMENT_METHOD_LABELS } from "@/domain/labels";
import type { Cents, FinancialTransaction, ISODate, ServiceOrder } from "@/domain/types";
import { MiniPlate } from "@/features/dashboard/yard";
import { addDays, addMonths, endOfMonth, formatBRL, formatOrderNumber, inRange, monthName, startOfMonth, startOfWeek, todayISO, weekday, weekdayName } from "@/lib/format";
import type { Receivable } from "@/services/finance";

/**
 * Caixa do Financeiro (decisão 81, direção B escolhida pelo usuário):
 * três abas grandes (Entrou · Saiu · Falta receber) como as de Serviços; uma
 * frase com o que sobrou; o calendário do mês pintado pelo valor de cada dia
 * (tocar num dia mostra o que aconteceu e a semana dele). Ícones Phosphor
 * duotone, nada de emoji.
 */

type Kind = "income" | "expense" | "receivable";

/** Um só conjunto (decisão 82): Phosphor duotone, mesma cor e mesmo círculo para tudo. */
const CATEGORY_ICON: Record<string, ReactNode> = {
  "Compra de peças": <Engine weight="duotone" />,
  Aluguel: <Storefront weight="duotone" />,
  Energia: <Lightbulb weight="duotone" />,
  Água: <Drop weight="duotone" />,
  Funcionários: <UsersThree weight="duotone" />,
  Ferramentas: <Wrench weight="duotone" />,
};

const WEEK = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const short = (cents: number) => formatBRL(cents as Cents).replace(/,00$/, "");

export function CashView({ period, receivedCents, expensesCents, receivables, onReceive }: {
  period: Period;
  receivedCents: Cents;
  expensesCents: Cents;
  receivables: Receivable[];
  onReceive: (r: Receivable) => void;
}) {
  const { view, can, online, customerOf, vehicleOf, openOrder } = useApp();
  const [kind, setKind] = useState<Kind>("income");
  const today = todayISO();
  const last = period.to > today ? today : period.to;

  const moves = view.transactions.filter((t) => t.status === "paid" && inRange(t.date, period.from, last));
  const incomes = moves.filter((t) => t.kind === "income");
  const expenses = moves.filter((t) => t.kind === "expense");
  const list = kind === "expense" ? expenses : incomes;
  const byDay = new Map<ISODate, FinancialTransaction[]>();
  for (const t of list) byDay.set(t.date, [...(byDay.get(t.date) ?? []), t]);
  const dayTotal = (d: ISODate) => (byDay.get(d) ?? []).reduce((s, t) => s + t.amountCents, 0);

  // Dia escolhido: o último com movimento do tipo da aba (ou o último dia do período).
  const latest = [...byDay.keys()].sort().at(-1) ?? last;
  const [picked, setPicked] = useState<ISODate | null>(null);
  const day = picked && inRange(picked, period.from, last) ? picked : latest;
  const [month, setMonth] = useState<ISODate | null>(null);
  const shownMonth = month && month >= startOfMonth(period.from) && month <= startOfMonth(last) ? month : startOfMonth(day);

  const result = receivedCents - expensesCents;
  const when = period.preset === "month" || period.preset === "last_month" ? `Em ${monthName(period.from).split(" ")[0]}` : "No período";
  const saying = result > 0 ? (result < receivedCents * 0.25 ? "entrou um pouco mais do que saiu." : "entrou bem mais do que saiu.") : result < 0 ? "saiu mais do que entrou." : "entrou o mesmo que saiu.";

  const pick = (d: ISODate) => { setPicked(d); setMonth(startOfMonth(d)); };
  const switchKind = (k: Kind) => { setKind(k); setPicked(null); setMonth(null); };

  return (
    <div className="cash">
      <div role="tablist" aria-label="O que ver" className="cash-tabs">
        <CashTab k="income" on={kind === "income"} onSelect={switchKind} icon={<TrayArrowDown weight="duotone" />} label="Entrou" value={receivedCents} count={incomes.length} />
        <CashTab k="expense" on={kind === "expense"} onSelect={switchKind} icon={<TrayArrowUp weight="duotone" />} label="Saiu" value={expensesCents} count={expenses.length} />
        <CashTab k="receivable" on={kind === "receivable"} onSelect={switchKind} icon={<ClockCountdown weight="duotone" />} label="Falta receber" value={receivables.reduce((s, r) => s + r.amountCents, 0) as Cents} count={receivables.length} />
      </div>

      <p className="cash-say">
        {when} <strong data-tone={result < 0 ? "down" : "up"}>{result < 0 ? `faltou ${formatBRL(-result as Cents)}` : `sobrou ${formatBRL(result as Cents)}`}</strong>: {saying}
      </p>

      <div id="cash-panel" role="tabpanel" aria-label={kind === "income" ? "Entrou" : kind === "expense" ? "Saiu" : "Falta receber"}>
        {kind === "receivable" ? (
          <section className="cash-card">
            {receivables.length === 0 ? <p className="cash-empty">Ninguém está devendo. Todos os serviços prontos foram pagos.</p> : (
              <ul className="cash-list">
                {receivables.map((r, i) => {
                  const v = r.order ? vehicleOf(r.order.vehicleId) : undefined;
                  const name = customerOf(r.customerId)?.name ?? "Cliente";
                  const days = Math.max(0, Math.round((Date.parse(today) - Date.parse(r.since)) / 86_400_000));
                  return (
                    <li key={r.key} className="cash-row" style={{ "--i": i } as React.CSSProperties}>
                      <PersonAvatar name={name} size={44} />
                      <span className="cash-row-main">
                        <b>{name}</b>
                        <small>{r.order ? `${formatOrderNumber(r.order.number)} · pronto ${days === 0 ? "hoje" : days === 1 ? "ontem" : `há ${days} dias`}` : r.transaction?.description}</small>
                      </span>
                      {v && <MiniPlate plate={v.plate} />}
                      <span className="cash-amt is-due">{formatBRL(r.amountCents)}</span>
                      {can("finance.payment") && <Button variant="primary" className="rounded-full" disabled={!online} onClick={() => onReceive(r)}>Receber</Button>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : (
          <div className="cash-two">
            <Calendar
              kind={kind}
              month={shownMonth}
              from={period.from}
              to={last}
              day={day}
              total={dayTotal}
              onPick={pick}
              onMonth={setMonth}
            />
            <DayDetail kind={kind} day={day} moves={byDay.get(day) ?? []} total={dayTotal} onPick={pick} from={period.from} to={last} orderOf={(id) => view.orders.find((o) => o.id === id)} customerName={(id) => (id ? customerOf(id)?.name : undefined)} plateOf={(o) => vehicleOf(o.vehicleId)?.plate} openOrder={openOrder} />
          </div>
        )}
      </div>
    </div>
  );
}

function CashTab({ k, on, onSelect, icon, label, value, count }: { k: Kind; on: boolean; onSelect: (k: Kind) => void; icon: ReactNode; label: string; value: Cents; count: number }) {
  return (
    <button type="button" role="tab" aria-selected={on} aria-controls="cash-panel" className="cash-tab" data-kind={k} onClick={() => onSelect(k)}>
      <span className="cash-tab-icon" aria-hidden>{icon}</span>
      <span className="cash-tab-text"><small>{label}</small><span className="cash-tab-value">{formatBRL(value)}</span></span>
      <span className="cash-tab-count" aria-label={`${count} ${count === 1 ? "lançamento" : "lançamentos"}`}>{count}</span>
    </button>
  );
}

function Calendar({ kind, month, from, to, day, total, onPick, onMonth }: {
  kind: Kind; month: ISODate; from: ISODate; to: ISODate; day: ISODate;
  total: (d: ISODate) => number; onPick: (d: ISODate) => void; onMonth: (m: ISODate) => void;
}) {
  const first = month;
  const end = endOfMonth(month);
  const cells: (ISODate | null)[] = Array(weekday(first)).fill(null);
  for (let d = first; d <= end; d = addDays(d, 1)) cells.push(d);
  const max = Math.max(1, ...cells.filter(Boolean).map((d) => total(d!)));
  const prev = startOfMonth(addMonths(month, -1));
  const next = startOfMonth(addMonths(month, 1));
  const word = kind === "income" ? "entrou" : "saiu";

  return (
    <section className="cash-card" aria-labelledby="cash-cal-title">
      <div className="cash-cal-head">
        <h2 id="cash-cal-title" className="cash-h2">Dias em que {word} dinheiro</h2>
        <span className="cash-cal-legend">{kind === "income" ? "Mais verde" : "Mais laranja"} = {word} mais</span>
      </div>
      <div className="cash-cal-month">
        <button type="button" className="cash-cal-nav" aria-label="Mês anterior" disabled={prev < startOfMonth(from)} onClick={() => onMonth(prev)}><CaretLeft size={18} weight="bold" aria-hidden /></button>
        <span className="cash-cal-name">{monthName(month)}</span>
        <button type="button" className="cash-cal-nav" aria-label="Próximo mês" disabled={next > startOfMonth(to)} onClick={() => onMonth(next)}><CaretRight size={18} weight="bold" aria-hidden /></button>
      </div>
      <div className="cash-cal" data-kind={kind} role="group" aria-label={`Calendário de ${monthName(month)}`}>
        {WEEK.map((w) => <span key={w} className="cash-cal-wd" aria-hidden>{w}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const v = total(d);
          const out = !inRange(d, from, to);
          return (
            <button
              key={d}
              type="button"
              className="cash-day"
              style={{ "--a": v ? 0.2 + 0.45 * (v / max) : 0, "--i": i } as React.CSSProperties}
              data-out={out || undefined}
              data-has={v ? true : undefined}
              aria-pressed={d === day}
              disabled={out}
              onClick={() => onPick(d)}
            >
              {/* O nome lido pelo leitor de tela começa pelo que aparece: "16, segunda: entrou R$ 560". */}
              <span className="cash-day-n">{Number(d.slice(8))}</span>
              <span className="sr-only">, {weekdayName(d)}: {v ? word : `nada ${word}`}</span>
              {v > 0 && <span className="cash-day-v">{short(v)}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function DayDetail({ kind, day, moves, total, onPick, from, to, orderOf, customerName, plateOf, openOrder }: {
  kind: Kind; day: ISODate; moves: FinancialTransaction[]; total: (d: ISODate) => number; onPick: (d: ISODate) => void; from: ISODate; to: ISODate;
  orderOf: (id: string) => ServiceOrder | undefined; customerName: (id: string | null) => string | undefined; plateOf: (o: ServiceOrder) => string | undefined; openOrder: (id: string) => void;
}) {
  const week = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(day), i));
  const max = Math.max(1, ...week.map(total));
  const word = kind === "income" ? "entrou" : "saiu";
  const title = `${weekdayName(day).replace(/^./, (c) => c.toUpperCase())}, ${day.slice(8)}/${day.slice(5, 7)}`;
  return (
    <section className="cash-card" aria-labelledby="cash-day-title" aria-live="polite">
      <h2 id="cash-day-title" className="cash-h2">{title}</h2>
      <p className="cash-hint">{moves.length ? `${moves.length === 1 ? "1 lançamento" : `${moves.length} lançamentos`} · ${word} ${formatBRL(total(day) as Cents)}` : `Nada ${word} neste dia. Toque num dia do calendário.`}</p>
      <ul key={day} className="cash-list">
        {moves.map((t, i) => {
          const order = t.orderId ? orderOf(t.orderId) : undefined;
          const who = customerName(t.customerId);
          return (
            <li key={t.id} className="cash-row" style={{ "--i": i } as React.CSSProperties}>
              {order ? <MiniPlate plate={plateOf(order)} /> : <span className="cash-cat" data-kind={t.kind} aria-hidden>{t.kind === "income" ? <Coins weight="duotone" /> : CATEGORY_ICON[t.category] ?? <Receipt weight="duotone" />}</span>}
              <span className="cash-row-main">
                <b>{who ?? t.description}</b>
                <small>
                  {order ? <button type="button" className="cash-link" onClick={() => openOrder(order.id)}>{formatOrderNumber(order.number)}</button> : t.kind === "expense" ? t.category : "Entrada sem serviço"}
                  {" · "}{PAYMENT_METHOD_LABELS[t.method]}
                </small>
              </span>
              <span className={`cash-amt ${t.kind === "income" ? "is-in" : "is-out"}`}>{t.kind === "income" ? "+" : "−"} {formatBRL(t.amountCents)}</span>
            </li>
          );
        })}
      </ul>
      <div className="cash-week">
        <b className="cash-week-title">Na semana</b>
        <div className="cash-week-bars" data-kind={kind}>
          {week.map((d, i) => {
            const v = total(d);
            const out = !inRange(d, from, to);
            return (
              <button key={d} type="button" className="cash-bar" disabled={out} aria-pressed={d === day} onClick={() => onPick(d)} style={{ "--h": v ? Math.max(0.08, v / max) : 0.04, "--i": i } as React.CSSProperties} data-has={v ? true : undefined}>
                <span className="cash-bar-fill" />
                <small>{WEEK[i]}</small>
                <span className="sr-only"> {Number(d.slice(8))}: {v ? `${word} ${formatBRL(v as Cents)}` : "nada"}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
