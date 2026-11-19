"use client";

import { CircleDollarSign, Minus, Plus, Receipt } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApp } from "@/app-state/app-context";
import { Pager, usePager } from "@/components/ui/pager";
import { ChoiceGroup, DayPicker, MoreDetails } from "@/components/ui/choice";
import { Dialog } from "@/components/ui/dialog";
import { Period, PeriodPicker, usePeriod } from "@/components/ui/period";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Segmented, Select, Stat, Tabs, Textarea } from "@/components/ui/primitives";
import { useReducedMotion } from "@/components/ui/use-reduced-motion";
import { useAccessibility } from "@/components/accessibility/accessibility-provider";
import { toast } from "@/components/ui/toast";
import { EXPENSE_CATEGORIES, PAYMENT_METHOD_LABELS } from "@/domain/labels";
import type { FinancialTransaction, PaymentMethod } from "@/domain/types";
import { PaymentDialog, PaymentMethodPicker } from "@/features/orders/order-dialogs";
import { CashChange, cashShort, PaymentMethodTiles, PaymentStage } from "@/features/orders/payment-stage";
import { vehicleLabel } from "@/features/orders/shared";
import { addDays, formatBRL, formatDate, formatOrderNumber, formatPlate, inRange, parseBRL, startOfWeek, todayISO } from "@/lib/format";
import { createExpense, createIncome, financeSummary, listReceivables, settleIncome } from "@/services/finance";
import { maskMoney } from "@/lib/masks";
import { FinanceResults } from "./finance-results";

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
      <div className="grid gap-4">
        <Field label={kind === "expense" ? "Com o que gastou?" : "Do que é esse dinheiro?"} hint={kind === "expense" ? "Ex.: conta de luz de novembro" : "Ex.: venda de peça no balcão"}>{(p) => <Input {...p} value={description} onChange={(e) => setDescription(e.target.value)} autoFocus />}</Field>
        <Field label="Quanto? (R$)">{(p) => <Input {...p} inputMode="decimal" value={amount} onChange={(e) => setAmount(maskMoney(e.target.value))} />}</Field>
        {kind === "expense" && (
          <ChoiceGroup label="Que tipo de gasto?" value={category} onChange={setCategory} options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))} />
        )}
        {kind === "income" && (
          <ChoiceGroup label="Já recebeu?" value={status} onChange={(v) => { setStatus(v); setDate(todayISO()); }} columns={2} options={[
            { value: "paid", label: "Já recebi", hint: "O dinheiro entrou", icon: <CircleDollarSign size={20} /> },
            { value: "pending", label: "Vou receber", hint: "Fica em Falta receber", icon: <Receipt size={20} /> },
          ]} />
        )}
        <DayPicker past={kind === "expense" || status === "paid"} label={kind === "expense" ? "Quando foi?" : status === "paid" ? "Quando recebeu?" : "Quando vai receber?"} value={date} onChange={setDate} key={kind === "expense" || status === "paid" ? "past" : "future"} />
        <PaymentMethodPicker value={method} onChange={setMethod} legend={kind === "expense" ? "Como foi pago?" : "Como o cliente pagou?"} />
        <MoreDetails summary={kind === "income" ? "Mais detalhes (opcional): cliente e observações" : "Mais detalhes (opcional): observações"}>
          {kind === "income" && (
            <Field label="De qual cliente?" optional>
              {(p) => (
                <Select {...p} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">Nenhum cliente</option>
                  {[...view.customers].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              )}
            </Field>
          )}
          <Field label="Observações" optional>{(p) => <Textarea {...p} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
        </MoreDetails>
      </div>
    </Dialog>
  );
}

export function SettleDialog({ tx, onClose }: { tx: FinancialTransaction; onClose: () => void }) {
  const { act, online, customerOf, settings } = useApp();
  const [method, setMethod] = useState<PaymentMethod>(tx.method);
  const [given, setGiven] = useState("");
  return (
    <Dialog
      title="Receber"
      subtitle={`${tx.description} · ${formatBRL(tx.amountCents)}`}
      size="md"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Voltar</Button>
          <Button
            variant="primary"
            disabled={!online || (method === "cash" && cashShort(tx.amountCents, given))}
            onClick={() => {
              const r = act((db, ctx) => settleIncome(db, ctx, tx.id, { method, date: todayISO() }), "Recebimento registrado.");
              if (r.ok) onClose();
            }}
          >
            Recebi {formatBRL(tx.amountCents)}
          </Button>
        </>
      }
    >
      <PaymentStage method={method} amountCents={tx.amountCents} customerName={customerOf(tx.customerId)?.name ?? tx.description} workshopName={settings.displayName} />
      <PaymentMethodTiles value={method} onChange={setMethod} />
      {method === "cash" && <CashChange totalCents={tx.amountCents} given={given} onGiven={setGiven} />}
    </Dialog>
  );
}

export function FinancePage() {
  const { view, can, online, customerOf, vehicleOf, openOrder } = useApp();
  const [period, setPeriod] = usePeriod("month");
  const [tab, setTab] = useState<"income" | "expense" | "receivable">("income");
  // Caixa (entradas e saídas) ou Resultados (antiga tela Desempenho, decisão 79).
  const [area, setArea] = useState<"cash" | "results">("cash");
  const [dialog, setDialog] = useState<null | "income" | "expense">(null);
  const [payOrder, setPayOrder] = useState<string | null>(null);
  const [settle, setSettle] = useState<FinancialTransaction | null>(null);

  const summary = financeSummary(view, period.from, period.to);
  const receivables = listReceivables(view);
  const receivablesPager = usePager(receivables, 20);
  const inPeriod = view.transactions.filter((t) => inRange(t.date, period.from, period.to)).sort((a, b) => b.date.localeCompare(a.date));
  const incomes = inPeriod.filter((t) => t.kind === "income");
  const incomesPager = usePager(incomes, 20);
  const expenses = inPeriod.filter((t) => t.kind === "expense");
  const expensesPager = usePager(expenses, 20);

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

      <div role="tablist" aria-label="Parte do Financeiro" className="fin-areas">
        <button type="button" role="tab" id="fin-tab-cash" aria-selected={area === "cash"} aria-controls="fin-area" onClick={() => setArea("cash")}>Caixa</button>
        <button type="button" role="tab" id="fin-tab-results" aria-selected={area === "results"} aria-controls="fin-area" onClick={() => setArea("results")}>Resultados</button>
      </div>

      <div id="fin-area" role="tabpanel" aria-labelledby={area === "cash" ? "fin-tab-cash" : "fin-tab-results"}>
      {area === "results" ? <FinanceResults period={period} /> : <>
      <div className="mb-4 grid grid-cols-4 gap-3">
        <Stat label="Receitas recebidas" value={summary.receivedCents} format={formatBRL} tone="success" hint="Entradas de caixa no período" />
        <Stat label="Despesas pagas" value={summary.expensesCents} format={formatBRL} tone="danger" hint="Saídas de caixa no período" />
        <Stat label="Contas a receber" value={summary.receivableCents} format={formatBRL} tone={receivables.length ? "warning" : "neutral"} hint={`${receivables.length} em aberto hoje`} />
        <Stat label="Sobrou no caixa" value={summary.cashResultCents} format={formatBRL} tone={summary.cashResultCents < 0 ? "danger" : "neutral"} hint="Recebido − despesas pagas" />
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
                  {incomesPager.items.map((t) => {
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
              <Pager pager={incomesPager} label="entradas" noun="entradas" />
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
                  {expensesPager.items.map((t) => (
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
              <Pager pager={expensesPager} label="saídas" noun="saídas" />
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
                  {receivablesPager.items.map((r) => {
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
              <Pager pager={receivablesPager} label="a receber" noun="valores" />
            </div>
          ))}
      </Card>
      </>}
      </div>

      {dialog && <TransactionDialog kind={dialog} onClose={() => setDialog(null)} />}
      {payOrder && <PaymentDialog orderId={payOrder} onClose={() => setPayOrder(null)} />}
      {settle && <SettleDialog tx={settle} onClose={() => setSettle(null)} />}
    </div>
  );
}
