import { z } from "zod";
import { EXPENSE_CATEGORIES } from "@/domain/labels";
import type { Database, FinancialTransaction, ID, ISODate, ServiceOrder } from "@/domain/types";
import { dateOf, inRange } from "@/lib/format";
import { assertCan, Ctx, DomainError, findScoped, newId, parse, WorkshopView } from "./core";
import { orderTotals, paymentSituation } from "./orders";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const method = z.enum(["cash", "pix", "card", "transfer"], { message: "Selecione a forma de pagamento." });

const expenseSchema = z.object({
  description: z.string().trim().min(3, "Descreva a despesa."),
  category: z.string().refine((c) => EXPENSE_CATEGORIES.includes(c), "Selecione uma categoria."),
  amountCents: z.number({ message: "Informe o valor." }).int().min(1, "Informe um valor maior que zero."),
  date: isoDate,
  method,
  notes: z.string().trim().default(""),
});

export type ExpenseInput = z.input<typeof expenseSchema>;

export function createExpense(db: Database, ctx: Ctx, input: ExpenseInput): FinancialTransaction {
  assertCan(db, ctx, "finance.expense");
  const data = parse(expenseSchema, input);
  const tx: FinancialTransaction = {
    id: newId(),
    workshopId: ctx.workshopId,
    kind: "expense",
    status: "paid",
    customerId: null,
    orderId: null,
    paymentId: null,
    userId: ctx.userId,
    ...data,
  };
  db.transactions.push(tx);
  return tx;
}

const incomeSchema = z.object({
  description: z.string().trim().min(3, "Descreva a receita."),
  amountCents: z.number({ message: "Informe o valor." }).int().min(1, "Informe um valor maior que zero."),
  date: isoDate,
  method,
  status: z.enum(["paid", "pending"]),
  customerId: z.string().nullable(),
  notes: z.string().trim().default(""),
});

export type IncomeInput = z.input<typeof incomeSchema>;

/** Receita avulsa (não vinculada a OS). Receitas de OS nascem de `registerPayment`. */
export function createIncome(db: Database, ctx: Ctx, input: IncomeInput): FinancialTransaction {
  assertCan(db, ctx, "finance.payment");
  const data = parse(incomeSchema, input);
  if (data.customerId) findScoped(db.customers, ctx, data.customerId, "Cliente não encontrado.");
  const tx: FinancialTransaction = {
    id: newId(),
    workshopId: ctx.workshopId,
    kind: "income",
    category: "Entrada sem serviço",
    orderId: null,
    paymentId: null,
    userId: ctx.userId,
    ...data,
  };
  db.transactions.push(tx);
  return tx;
}

export function settleIncome(db: Database, ctx: Ctx, transactionId: ID, input: { method: FinancialTransaction["method"]; date: ISODate }): void {
  assertCan(db, ctx, "finance.payment");
  const tx = findScoped(db.transactions, ctx, transactionId, "Lançamento não encontrado.");
  if (tx.kind !== "income" || tx.status === "paid") {
    throw new DomainError("conflict", "Este lançamento já está recebido.");
  }
  tx.status = "paid";
  tx.method = input.method;
  tx.date = input.date;
}

/* ---------- Consultas ---------- */

export interface Receivable {
  key: string;
  order: ServiceOrder | null;
  transaction: FinancialTransaction | null;
  customerId: ID | null;
  amountCents: number;
  since: ISODate;
}

/** OS concluídas e não pagas + receitas avulsas pendentes. */
export function listReceivables(view: WorkshopView): Receivable[] {
  const fromOrders: Receivable[] = view.orders
    .filter((o) => o.status === "done" && paymentSituation(o, orderTotals(view, o)) === "pending")
    .map((o) => ({
      key: `os-${o.id}`,
      order: o,
      transaction: null,
      customerId: o.customerId,
      amountCents: orderTotals(view, o).totalCents,
      since: dateOf(o.completedAt ?? o.openedAt),
    }));
  const manual: Receivable[] = view.transactions
    .filter((t) => t.kind === "income" && t.status === "pending")
    .map((t) => ({
      key: `tx-${t.id}`,
      order: null,
      transaction: t,
      customerId: t.customerId,
      amountCents: t.amountCents,
      since: t.date,
    }));
  return [...fromOrders, ...manual].sort((a, b) => a.since.localeCompare(b.since));
}

export interface FinanceSummary {
  /** Receitas efetivamente recebidas no período (entrada de caixa). */
  receivedCents: number;
  /** Despesas pagas no período (saída de caixa). */
  expensesCents: number;
  /** Recebido − despesas pagas. É resultado de caixa, não lucro contábil. */
  cashResultCents: number;
  /** Total em aberto hoje, independentemente do período. */
  receivableCents: number;
  /** Valor das OS concluídas no período, pagas ou não. */
  billedCents: number;
}

export function financeSummary(view: WorkshopView, from: ISODate, to: ISODate): FinanceSummary {
  let receivedCents = 0;
  let expensesCents = 0;
  for (const t of view.transactions) {
    if (t.status !== "paid" || !inRange(t.date, from, to)) continue;
    if (t.kind === "income") receivedCents += t.amountCents;
    else expensesCents += t.amountCents;
  }
  let billedCents = 0;
  for (const o of view.orders) {
    if (o.cancelledAt || o.status !== "done" || !o.completedAt) continue;
    if (inRange(dateOf(o.completedAt), from, to)) billedCents += orderTotals(view, o).totalCents;
  }
  return {
    receivedCents,
    expensesCents,
    cashResultCents: receivedCents - expensesCents,
    receivableCents: listReceivables(view).reduce((s, r) => s + r.amountCents, 0),
    billedCents,
  };
}
