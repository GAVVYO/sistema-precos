"use client";

import { CircleDollarSign, Minus, Plus, Receipt } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/app-state/app-context";
import { ChoiceGroup, DayPicker, MoreDetails } from "@/components/ui/choice";
import { Dialog } from "@/components/ui/dialog";
import { PeriodPicker, usePeriod } from "@/components/ui/period";
import { Button, Field, Input, PageHeader, Select, Textarea } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { EXPENSE_CATEGORIES } from "@/domain/labels";
import type { FinancialTransaction, PaymentMethod } from "@/domain/types";
import { PaymentDialog, PaymentMethodPicker } from "@/features/orders/order-dialogs";
import { CashChange, cashShort, PaymentMethodTiles, PaymentStage } from "@/features/orders/payment-stage";
import { formatBRL, parseBRL, todayISO } from "@/lib/format";
import { createExpense, createIncome, financeSummary, listReceivables, settleIncome } from "@/services/finance";
import { maskMoney } from "@/lib/masks";
import { CashView } from "./cash-view";
import { FinanceResults } from "./finance-results";

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
      title={kind === "expense" ? "Lançar gasto" : "Entrada sem serviço"}
      subtitle={kind === "income" ? "Para receber de um serviço, use o botão Receber no próprio serviço." : undefined}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={!online} onClick={save}>{kind === "expense" ? "Salvar gasto" : "Salvar entrada"}</Button>
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
  const { view, can, online } = useApp();
  const [period, setPeriod] = usePeriod("month");
  // Caixa (entradas e saídas) ou Resultados (antiga tela Desempenho, decisão 79).
  const [area, setArea] = useState<"cash" | "results">("cash");
  const [dialog, setDialog] = useState<null | "income" | "expense">(null);
  const [payOrder, setPayOrder] = useState<string | null>(null);
  const [settle, setSettle] = useState<FinancialTransaction | null>(null);

  const summary = financeSummary(view, period.from, period.to);
  const receivables = listReceivables(view);

  return (
    <div className="module-page module-finance">
      <PageHeader
        title="Financeiro"
        description="Quanto entrou, quanto saiu e quem ainda está devendo."
        actions={
          <>
            <PeriodPicker value={period} onChange={setPeriod} />
            {can("finance.payment") && <Button icon={<Plus className="size-4" aria-hidden />} disabled={!online} onClick={() => setDialog("income")}>Entrada sem serviço</Button>}
            {can("finance.expense") && <Button variant="primary" icon={<Minus className="size-4" aria-hidden />} disabled={!online} onClick={() => setDialog("expense")}>Lançar gasto</Button>}
          </>
        }
      />

      <div role="tablist" aria-label="Parte do Financeiro" className="fin-areas">
        <button type="button" role="tab" id="fin-tab-cash" aria-selected={area === "cash"} aria-controls="fin-area" onClick={() => setArea("cash")}>Caixa</button>
        <button type="button" role="tab" id="fin-tab-results" aria-selected={area === "results"} aria-controls="fin-area" onClick={() => setArea("results")}>Resultados</button>
      </div>

      <div id="fin-area" role="tabpanel" aria-labelledby={area === "cash" ? "fin-tab-cash" : "fin-tab-results"}>
      {area === "results" ? <FinanceResults period={period} /> : (
        <CashView
          period={period}
          receivedCents={summary.receivedCents}
          expensesCents={summary.expensesCents}
          receivables={receivables}
          onReceive={(r) => (r.order ? setPayOrder(r.order.id) : r.transaction && setSettle(r.transaction))}
        />
      )}
      </div>

      {dialog && <TransactionDialog kind={dialog} onClose={() => setDialog(null)} />}
      {payOrder && <PaymentDialog orderId={payOrder} onClose={() => setPayOrder(null)} />}
      {settle && <SettleDialog tx={settle} onClose={() => setSettle(null)} />}
    </div>
  );
}
