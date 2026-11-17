"use client";

import { CircleDollarSign, Minus, Plus, Receipt } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApp } from "@/app-state/app-context";
import { Dialog } from "@/components/ui/dialog";
import { Period, PeriodPicker, usePeriod } from "@/components/ui/period";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Segmented, Select, Stat, Tabs, Textarea } from "@/components/ui/primitives";
import { useReducedMotion } from "@/components/ui/use-reduced-motion";
import { useAccessibility } from "@/components/accessibility/accessibility-provider";
import { toast } from "@/components/ui/toast";
import { EXPENSE_CATEGORIES, PAYMENT_METHOD_LABELS } from "@/domain/labels";
import type { FinancialTransaction, PaymentMethod } from "@/domain/types";
import { PaymentDialog, PaymentMethodPicker } from "@/features/orders/order-dialogs";
import { vehicleLabel } from "@/features/orders/shared";
import { addDays, formatBRL, formatDate, formatOrderNumber, formatPlate, inRange, parseBRL, startOfWeek, todayISO } from "@/lib/format";
import { createExpense, createIncome, financeSummary, listReceivables, settleIncome } from "@/services/finance";

/** Par de cores validado para daltonismo; independe da cor da oficina. */
const SERIES = { received: "#2563EB", expenses: "#D97706" };

function CashChart({ period, transactions }: { period: Period; transactions: FinancialTransaction[] }) {
  const reducedMotion = useReducedMotion();
  const { preferences } = useAccessibility();
  const textScale = preferences.textSize === "larger" ? 1.5 : preferences.textSize === "large" ? 1.25 : 1;
  const [grouping, setGrouping] = useState<"day" | "week">("week");
  const data = useMemo(() => {
    const to = period.to > todayISO() ? todayISO() : period.to;
    const weekly = grouping === "week";
    const buckets = new Map<string, { label: string; received: number; expenses: number }>();
    for (let d = weekly ? startOfWeek(period.from) : period.from; d <= to; d = addDays(d, weekly ? 7 : 1)) {
      buckets.set(d, { label: weekly ? `Sem. ${formatDate(d).slice(0, 5)}` : formatDate(d).slice(0, 5), received: 0, expenses: 0 });
    }
    for (const t of transactions) {
      if (t.status !== "paid" || !inRange(t.date, period.from, to)) continue;
      const b = buckets.get(weekly ? startOfWeek(t.date) : t.date);
      if (!b) continue;
      if (t.kind === "income") b.received += t.amountCents / 100;
      else b.expenses += t.amountCents / 100;
    }
    return [...buckets.values()];
  }, [period, transactions, grouping]);

  if (!data.some((d) => d.received || d.expenses)) {
    return <EmptyState title="Nenhum dinheiro entrou ou saiu neste período" description="Quando você receber um serviço ou lançar uma despesa, o gráfico aparece aqui. Também dá para escolher outro período no alto da tela." />;
  }
  const brl = (v: number) => formatBRL(Math.round(v * 100));
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4"><p className="text-xs text-muted">{grouping === "week" ? "Totais por semana dentro do período selecionado" : "Movimentações por dia"}</p><Segmented label="Agrupar fluxo de caixa" value={grouping} onChange={setGrouping} options={[{ value: "day", label: "Por dia" }, { value: "week", label: "Por semana" }]} /></div>
      <div className="h-56 px-2 pt-3 pb-1">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={2} barCategoryGap="25%">
          <CartesianGrid vertical={false} stroke="#E2E8F0" />
          <XAxis dataKey="label" tick={{ fontSize: ".875rem", fill: "var(--muted)" }} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} interval="preserveStartEnd" minTickGap={12} />
          <YAxis tick={{ fontSize: ".875rem", fill: "var(--muted)" }} tickLine={false} axisLine={false} width={Math.round(88 * textScale)} tickFormatter={(v: number) => `R$ ${v.toLocaleString("pt-BR")}`} />
          <Tooltip
            cursor={{ fill: "#F1F5F9" }}
            formatter={(value, name) => [brl(Number(value)), name]}
            contentStyle={{ fontSize: ".875rem", borderRadius: 6, borderColor: "#E2E8F0", color: "#172033" }}
            itemStyle={{ color: "#172033" }}
          />
          <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: ".875rem" }} formatter={(v) => <span style={{ color: "#172033" }}>{v}</span>} />
          <Bar dataKey="received" name="Receitas recebidas" fill={SERIES.received} radius={[4, 4, 0, 0]} maxBarSize={grouping === "week" ? 52 : 22} isAnimationActive={!reducedMotion} animationDuration={360} animationEasing="ease-out" />
          <Bar dataKey="expenses" name="Despesas pagas" fill={SERIES.expenses} radius={[4, 4, 0, 0]} maxBarSize={grouping === "week" ? 52 : 22} isAnimationActive={!reducedMotion} animationDuration={360} animationEasing="ease-out" />
        </BarChart>
      </ResponsiveContainer>
      </div>
      <details className="border-t border-line p-4">
        <summary className="rounded py-2 text-sm font-semibold text-primary">Ver valores do gráfico em tabela</summary>
        <table tabIndex={0} aria-label="Valores do fluxo de caixa" className="data-table mt-3">
          <thead><tr><th scope="col">Período</th><th scope="col">Receitas recebidas</th><th scope="col">Despesas pagas</th></tr></thead>
          <tbody>{data.map(bucket => <tr key={bucket.label}><th scope="row">{bucket.label}</th><td>{brl(bucket.received)}</td><td>{brl(bucket.expenses)}</td></tr>)}</tbody>
        </table>
      </details>
    </div>
  );
}

function TransactionDialog({ kind, onClose }: { kind: "income" | "expense"; onClose: () => void }) {
  const { act, online, view } = useApp();
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [status, setStatus] = useState<"paid" | "pending">("paid");
  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");

  const save = () => {
    const amountCents = parseBRL(amount);
    if (amountCents === null) return toast("error", "Informe um valor válido. Ex.: 150,00");
    const r =
      kind === "expense"
        ? act((db, ctx) => createExpense(db, ctx, { description, category, amountCents, date, method, notes }), "Despesa registrada.")
        : act((db, ctx) => createIncome(db, ctx, { description, amountCents, date, method, status, customerId: customerId || null, notes }), "Entrada registrada.");
    if (r.ok) onClose();
  };

  return (
    <Dialog
      title={kind === "expense" ? "Nova despesa" : "Entrada sem serviço"}
      subtitle={kind === "income" ? "Para receber de um serviço, use o botão Receber no próprio serviço." : undefined}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={!online} onClick={save}>{kind === "expense" ? "Registrar despesa" : "Registrar entrada"}</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Descrição" className="col-span-2">{(p) => <Input {...p} value={description} onChange={(e) => setDescription(e.target.value)} autoFocus />}</Field>
        {kind === "expense" ? (
          <Field label="Categoria">
            {(p) => <Select {...p} value={category} onChange={(e) => setCategory(e.target.value)}>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select>}
          </Field>
        ) : (
          <Field label="Cliente" optional>
            {(p) => (
              <Select {...p} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Sem cliente vinculado</option>
                {[...view.customers].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            )}
          </Field>
        )}
        <Field label="Valor (R$)">{(p) => <Input {...p} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />}</Field>
        <Field label="Data">{(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        {kind === "income" && (
          <Field label="Situação">
            {(p) => (
              <Select {...p} value={status} onChange={(e) => setStatus(e.target.value as "paid" | "pending")}>
                <option value="paid">Recebida</option>
                <option value="pending">A receber</option>
              </Select>
            )}
          </Field>
        )}
        <div className="col-span-2">
          <p className="mb-1 text-xs font-medium">Forma de pagamento</p>
          <PaymentMethodPicker value={method} onChange={setMethod} />
        </div>
        <Field label="Observações" optional className="col-span-2">{(p) => <Textarea {...p} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
      </div>
    </Dialog>
  );
}

function SettleDialog({ tx, onClose }: { tx: FinancialTransaction; onClose: () => void }) {
  const { act, online } = useApp();
  const [method, setMethod] = useState<PaymentMethod>(tx.method);
  return (
    <Dialog
      title="Registrar recebimento"
      subtitle={`${tx.description} · ${formatBRL(tx.amountCents)}`}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Voltar</Button>
          <Button
            variant="primary"
            disabled={!online}
            onClick={() => {
              const r = act((db, ctx) => settleIncome(db, ctx, tx.id, { method, date: todayISO() }), "Recebimento registrado.");
              if (r.ok) onClose();
            }}
          >
            Confirmar recebimento
          </Button>
        </>
      }
    >
      <p className="mb-1 text-xs font-medium">Forma de pagamento</p>
      <PaymentMethodPicker value={method} onChange={setMethod} />
    </Dialog>
  );
}

export function FinancePage() {
  const { view, can, online, customerOf, vehicleOf, openOrder } = useApp();
  const [period, setPeriod] = usePeriod("month");
  const [tab, setTab] = useState<"income" | "expense" | "receivable">("income");
  const [dialog, setDialog] = useState<null | "income" | "expense">(null);
  const [payOrder, setPayOrder] = useState<string | null>(null);
  const [settle, setSettle] = useState<FinancialTransaction | null>(null);

  const summary = financeSummary(view, period.from, period.to);
  const receivables = listReceivables(view);
  const inPeriod = view.transactions.filter((t) => inRange(t.date, period.from, period.to)).sort((a, b) => b.date.localeCompare(a.date));
  const incomes = inPeriod.filter((t) => t.kind === "income");
  const expenses = inPeriod.filter((t) => t.kind === "expense");

  return (
    <div className="module-page module-finance">
      <PageHeader
        title="Financeiro"
        description="Quanto a oficina recebeu, gastou e ainda tem a receber."
        actions={
          <>
            <PeriodPicker value={period} onChange={setPeriod} />
            {can("finance.payment") && <Button icon={<Plus className="size-4" aria-hidden />} disabled={!online} onClick={() => setDialog("income")}>Entrada sem serviço</Button>}
            {can("finance.expense") && <Button variant="primary" icon={<Minus className="size-4" aria-hidden />} disabled={!online} onClick={() => setDialog("expense")}>Nova despesa</Button>}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-4 gap-3">
        <Stat label="Receitas recebidas" value={formatBRL(summary.receivedCents)} tone="success" hint="Entradas de caixa no período" />
        <Stat label="Despesas pagas" value={formatBRL(summary.expensesCents)} tone="danger" hint="Saídas de caixa no período" />
        <Stat label="Contas a receber" value={formatBRL(summary.receivableCents)} tone={receivables.length ? "warning" : "neutral"} hint={`${receivables.length} em aberto hoje`} />
        <Stat label="Sobrou no caixa" value={formatBRL(summary.cashResultCents)} tone={summary.cashResultCents < 0 ? "danger" : "neutral"} hint="Recebido − despesas pagas" />
      </div>

      <Card className="mb-4">
        <CardHeader
          title="Fluxo de caixa"
          subtitle={`${formatDate(period.from)} a ${formatDate(period.to)}`}
          actions={
            <span className="text-xs text-muted">
              Valor dos serviços prontos (pagos ou não): <strong className="text-ink">{formatBRL(summary.billedCents)}</strong>
            </span>
          }
        />
        <CashChart period={period} transactions={view.transactions} />
        <p className="border-t border-line px-4 py-2 text-xs text-muted">
          “Sobrou no caixa” não é lucro contábil: considera apenas valores efetivamente recebidos e pagos no período. O custo das peças entra pelas despesas de compra, não é descontado novamente das receitas.
        </p>
      </Card>

      <Card>
        <div className="px-3 pt-1">
          <Tabs
            label="Lançamentos"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "income", label: "Receitas", count: incomes.length },
              { value: "expense", label: "Despesas", count: expenses.length },
              { value: "receivable", label: "Contas a receber", count: receivables.length },
            ]}
          />
        </div>

        {tab === "income" &&
          (incomes.length === 0 ? (
            <EmptyState icon={<CircleDollarSign className="size-8" aria-hidden />} title="Nada recebido neste período" description="Quando você clicar em Receber num serviço, o valor aparece aqui." />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Data</th><th>Cliente</th><th>Serviço</th><th>Descrição</th><th>Forma</th><th>Situação</th><th className="num">Valor</th></tr></thead>
                <tbody>
                  {incomes.map((t) => {
                    const order = t.orderId ? view.orders.find((o) => o.id === t.orderId) : null;
                    return (
                      <tr key={t.id}>
                        <td>{formatDate(t.date)}</td>
                        <td>{customerOf(t.customerId)?.name ?? "—"}</td>
                        <td>{order ? <button type="button" className="font-semibold text-primary hover:underline" onClick={() => openOrder(order.id)}>{formatOrderNumber(order.number)}</button> : "—"}</td>
                        <td>{t.description}</td>
                        <td>{t.status === "paid" ? PAYMENT_METHOD_LABELS[t.method] : "—"}</td>
                        <td>{t.status === "paid" ? <Badge tone="success">Recebida</Badge> : <Badge tone="warning">A receber</Badge>}</td>
                        <td className="num font-medium">{formatBRL(t.amountCents)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}

        {tab === "expense" &&
          (expenses.length === 0 ? (
            <EmptyState icon={<Receipt className="size-8" aria-hidden />} title="Nenhuma despesa neste período" description="Lance aqui contas pagas: compra de peças, aluguel, energia…" action={can("finance.expense") ? <Button disabled={!online} onClick={() => setDialog("expense")}>Nova despesa</Button> : undefined} />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Forma</th><th>Observações</th><th className="num">Valor</th></tr></thead>
                <tbody>
                  {expenses.map((t) => (
                    <tr key={t.id}>
                      <td>{formatDate(t.date)}</td>
                      <td>{t.description}</td>
                      <td>{t.category}</td>
                      <td>{PAYMENT_METHOD_LABELS[t.method]}</td>
                      <td className="text-muted">{t.notes || "—"}</td>
                      <td className="num font-medium">{formatBRL(t.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        {tab === "receivable" &&
          (receivables.length === 0 ? (
            <EmptyState icon={<CircleDollarSign className="size-8" aria-hidden />} title="Nada a receber" description="Todos os serviços prontos já foram pagos." />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Desde</th><th>Cliente</th><th>Veículo</th><th>Origem</th><th className="num">Valor pendente</th><th className="text-right">Ação</th></tr></thead>
                <tbody>
                  {receivables.map((r) => {
                    const v = r.order ? vehicleOf(r.order.vehicleId) : undefined;
                    return (
                      <tr key={r.key}>
                        <td>{formatDate(r.since)}</td>
                        <td>{customerOf(r.customerId)?.name ?? "—"}</td>
                        <td>{v ? `${vehicleLabel(v)} · ${formatPlate(v.plate)}` : "—"}</td>
                        <td>
                          {r.order ? (
                            <button type="button" className="font-semibold text-primary hover:underline" onClick={() => openOrder(r.order!.id)}>{formatOrderNumber(r.order.number)}</button>
                          ) : (
                            r.transaction?.description
                          )}
                        </td>
                        <td className="num font-semibold">{formatBRL(r.amountCents)}</td>
                        <td className="text-right">
                          {can("finance.payment") && (
                            <Button size="sm" variant="primary" disabled={!online} onClick={() => (r.order ? setPayOrder(r.order.id) : setSettle(r.transaction))}>
                              Receber
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
      </Card>

      {dialog && <TransactionDialog kind={dialog} onClose={() => setDialog(null)} />}
      {payOrder && <PaymentDialog orderId={payOrder} onClose={() => setPayOrder(null)} />}
      {settle && <SettleDialog tx={settle} onClose={() => setSettle(null)} />}
    </div>
  );
}
