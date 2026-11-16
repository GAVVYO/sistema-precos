import { MOVEMENT_TYPE_LABELS, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/domain/labels";
import type { ISODate, OrderStatus, PermissionKey } from "@/domain/types";
import type { ReportData } from "@/lib/export";
import { dateOf, formatBRL, formatOrderNumber, formatPlate, inRange } from "@/lib/format";
import type { WorkshopView } from "./core";
import { listReceivables } from "./finance";
import { orderTotals, PAYMENT_SITUATION_LABELS, paymentSituation } from "./orders";
import { partSituation } from "./stock";

export type ReportKind = "orders" | "finance" | "receivables" | "stock" | "stock_moves" | "history";

export interface ReportInfo {
  kind: ReportKind;
  label: string;
  description: string;
  permission: PermissionKey;
  usesPeriod: boolean;
}

export const REPORTS: ReportInfo[] = [
  { kind: "orders", label: "Ordens de serviço", description: "OS abertas no período, com status, pagamento e valores.", permission: "os.view", usesPeriod: true },
  { kind: "finance", label: "Movimentações financeiras", description: "Receitas e despesas do período e resultado de caixa.", permission: "finance.view", usesPeriod: true },
  { kind: "receivables", label: "Contas a receber", description: "Valores em aberto hoje, por cliente e OS.", permission: "finance.view", usesPeriod: false },
  { kind: "stock", label: "Posição de estoque", description: "Quantidades atuais, mínimos e valor em estoque.", permission: "stock.view", usesPeriod: false },
  { kind: "stock_moves", label: "Movimentações de estoque", description: "Entradas, saídas, ajustes e devoluções do período.", permission: "stock.view", usesPeriod: true },
  { kind: "history", label: "Histórico de serviços", description: "Serviços concluídos no período, por veículo.", permission: "customers.view", usesPeriod: true },
];

export interface ReportFilters {
  from: ISODate;
  to: ISODate;
  /** OS: status ou "cancelled". Financeiro: "income" | "expense". Estoque: situação. */
  option: string;
  mechanicId: string;
  /** Histórico: placa, cliente ou veículo. */
  text: string;
}

const PART_SITUATION = { ok: "Normal", low: "Estoque baixo", out: "Sem estoque" };

/** Monta o relatório a partir da visão JÁ restrita à oficina do usuário. */
export function buildReport(view: WorkshopView, kind: ReportKind, f: ReportFilters): ReportData {
  const customer = (id: string | null) => view.customers.find((c) => c.id === id)?.name ?? "";
  const vehicle = (id: string) => view.vehicles.find((v) => v.id === id);
  const user = (id: string | null) => view.users.find((u) => u.id === id)?.name ?? "";
  const part = (id: string) => view.parts.find((p) => p.id === id);
  const period = { from: f.from, to: f.to };
  const sum = (rows: ReportData["rows"], key: string) => rows.reduce((s, r) => s + ((r[key] as number) ?? 0), 0);

  switch (kind) {
    case "orders": {
      const rows = view.orders
        .filter((o) => inRange(dateOf(o.openedAt), f.from, f.to))
        .filter((o) => (f.option === "cancelled" ? !!o.cancelledAt : f.option ? !o.cancelledAt && o.status === (f.option as OrderStatus) : true))
        .filter((o) => !f.mechanicId || o.mechanicId === f.mechanicId)
        .sort((a, b) => a.number - b.number)
        .map((o) => {
          const t = orderTotals(view, o);
          const v = vehicle(o.vehicleId);
          return {
            number: formatOrderNumber(o.number),
            opened: dateOf(o.openedAt),
            customer: customer(o.customerId),
            vehicle: v ? `${v.brand} ${v.model}` : "",
            plate: v ? formatPlate(v.plate) : "",
            service: o.description,
            mechanic: user(o.mechanicId),
            status: o.cancelledAt ? "Cancelada" : ORDER_STATUS_LABELS[o.status],
            payment: PAYMENT_SITUATION_LABELS[paymentSituation(o, t)],
            labor: t.laborCents,
            parts: t.partsCents,
            // Canceladas não entram no total faturável.
            total: o.cancelledAt ? null : t.totalCents,
          };
        });
      return {
        title: "Ordens de serviço",
        period,
        columns: [
          { key: "number", label: "OS", type: "text", width: 10 },
          { key: "opened", label: "Abertura", type: "date" },
          { key: "customer", label: "Cliente", type: "text" },
          { key: "vehicle", label: "Veículo", type: "text", width: 20 },
          { key: "plate", label: "Placa", type: "text", width: 11 },
          { key: "service", label: "Serviço", type: "text", width: 38 },
          { key: "mechanic", label: "Responsável", type: "text", width: 24 },
          { key: "status", label: "Status", type: "text", width: 14 },
          { key: "payment", label: "Pagamento", type: "text", width: 20 },
          { key: "labor", label: "Mão de obra", type: "money" },
          { key: "parts", label: "Peças", type: "money" },
          { key: "total", label: "Total", type: "money" },
        ],
        rows,
        totals: { labor: sum(rows, "labor"), parts: sum(rows, "parts"), total: sum(rows, "total") },
      };
    }
    case "finance": {
      const rows = view.transactions
        .filter((t) => inRange(t.date, f.from, f.to) && (!f.option || t.kind === f.option))
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((t) => ({
          date: t.date,
          kind: t.kind === "income" ? "Receita" : "Despesa",
          description: t.description,
          category: t.category,
          customer: customer(t.customerId),
          method: t.status === "paid" ? PAYMENT_METHOD_LABELS[t.method] : "",
          status: t.status === "paid" ? (t.kind === "income" ? "Recebida" : "Paga") : "A receber",
          income: t.kind === "income" && t.status === "paid" ? t.amountCents : null,
          expense: t.kind === "expense" && t.status === "paid" ? t.amountCents : null,
          pending: t.status === "pending" ? t.amountCents : null,
        }));
      const income = sum(rows, "income");
      const expense = sum(rows, "expense");
      return {
        title: "Movimentações financeiras",
        period,
        columns: [
          { key: "date", label: "Data", type: "date" },
          { key: "kind", label: "Tipo", type: "text", width: 11 },
          { key: "description", label: "Descrição", type: "text", width: 36 },
          { key: "category", label: "Categoria", type: "text", width: 20 },
          { key: "customer", label: "Cliente", type: "text" },
          { key: "method", label: "Forma", type: "text", width: 15 },
          { key: "status", label: "Situação", type: "text", width: 12 },
          { key: "income", label: "Entrada", type: "money" },
          { key: "expense", label: "Saída", type: "money" },
          { key: "pending", label: "A receber", type: "money" },
        ],
        rows,
        totals: { income, expense, pending: sum(rows, "pending") },
        summary: [
          { label: "Receitas recebidas", value: formatBRL(income) },
          { label: "Despesas pagas", value: formatBRL(expense) },
          { label: "Resultado de caixa (não é lucro contábil)", value: formatBRL(income - expense) },
        ],
      };
    }
    case "receivables": {
      const rows = listReceivables(view).map((r) => {
        const v = r.order ? vehicle(r.order.vehicleId) : undefined;
        return {
          since: r.since,
          customer: customer(r.customerId),
          vehicle: v ? `${v.brand} ${v.model} · ${formatPlate(v.plate)}` : "",
          origin: r.order ? formatOrderNumber(r.order.number) : (r.transaction?.description ?? ""),
          amount: r.amountCents,
        };
      });
      return {
        title: "Contas a receber",
        columns: [
          { key: "since", label: "Desde", type: "date" },
          { key: "customer", label: "Cliente", type: "text" },
          { key: "vehicle", label: "Veículo", type: "text", width: 30 },
          { key: "origin", label: "Origem", type: "text", width: 30 },
          { key: "amount", label: "Valor pendente", type: "money", width: 18 },
        ],
        rows,
        totals: { amount: sum(rows, "amount") },
      };
    }
    case "stock": {
      const rows = view.parts
        .filter((p) => !f.option || partSituation(p) === f.option)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => ({
          code: p.code,
          name: p.name,
          category: p.category,
          quantity: p.quantity,
          min: p.minQuantity,
          cost: p.costCents,
          price: p.priceCents,
          value: p.quantity * p.costCents,
          situation: PART_SITUATION[partSituation(p)],
        }));
      return {
        title: "Posição de estoque",
        columns: [
          { key: "code", label: "Código", type: "text", width: 12 },
          { key: "name", label: "Nome", type: "text", width: 36 },
          { key: "category", label: "Categoria", type: "text", width: 16 },
          { key: "quantity", label: "Disponível", type: "number", width: 12 },
          { key: "min", label: "Mínimo", type: "number", width: 10 },
          { key: "cost", label: "Custo unit.", type: "money" },
          { key: "price", label: "Preço de venda", type: "money" },
          { key: "value", label: "Valor em estoque (custo)", type: "money", width: 24 },
          { key: "situation", label: "Situação", type: "text", width: 15 },
        ],
        rows,
        totals: { value: sum(rows, "value") },
      };
    }
    case "stock_moves": {
      const rows = view.stockMovements
        .filter((m) => inRange(dateOf(m.at), f.from, f.to) && (!f.option || m.type === f.option))
        .sort((a, b) => a.at.localeCompare(b.at))
        .map((m) => ({
          date: dateOf(m.at),
          part: part(m.partId)?.name ?? "",
          code: part(m.partId)?.code ?? "",
          type: MOVEMENT_TYPE_LABELS[m.type],
          delta: m.delta,
          balance: m.balanceAfter,
          reason: m.reason,
          user: user(m.userId),
        }));
      return {
        title: "Movimentações de estoque",
        period,
        columns: [
          { key: "date", label: "Data", type: "date" },
          { key: "code", label: "Código", type: "text", width: 12 },
          { key: "part", label: "Peça", type: "text", width: 34 },
          { key: "type", label: "Tipo", type: "text", width: 20 },
          { key: "delta", label: "Quantidade", type: "number", width: 12 },
          { key: "balance", label: "Saldo após", type: "number", width: 12 },
          { key: "reason", label: "Motivo", type: "text", width: 40 },
          { key: "user", label: "Responsável", type: "text", width: 24 },
        ],
        rows,
      };
    }
    case "history": {
      const q = f.text.trim().toLowerCase();
      const qPlate = q.replace(/[^a-z0-9]/g, "");
      const rows = view.orders
        .filter((o) => !o.cancelledAt && o.status === "done" && o.completedAt && inRange(dateOf(o.completedAt), f.from, f.to))
        .filter((o) => {
          if (!q) return true;
          const v = vehicle(o.vehicleId);
          return customer(o.customerId).toLowerCase().includes(q) || (qPlate !== "" && (v?.plate.toLowerCase().includes(qPlate) ?? false)) || (v ? `${v.brand} ${v.model}`.toLowerCase().includes(q) : false);
        })
        .sort((a, b) => a.completedAt!.localeCompare(b.completedAt!))
        .map((o) => {
          const v = vehicle(o.vehicleId);
          return {
            date: dateOf(o.completedAt!),
            number: formatOrderNumber(o.number),
            customer: customer(o.customerId),
            vehicle: v ? `${v.brand} ${v.model}` : "",
            plate: v ? formatPlate(v.plate) : "",
            service: o.description,
            parts: view.orderItems.filter((i) => i.orderId === o.id).map((i) => `${i.quantity}× ${part(i.partId)?.name ?? "peça"}`).join(", "),
            mechanic: user(o.mechanicId),
            total: orderTotals(view, o).totalCents,
          };
        });
      return {
        title: "Histórico de serviços",
        period,
        columns: [
          { key: "date", label: "Conclusão", type: "date" },
          { key: "number", label: "OS", type: "text", width: 10 },
          { key: "customer", label: "Cliente", type: "text" },
          { key: "vehicle", label: "Veículo", type: "text", width: 20 },
          { key: "plate", label: "Placa", type: "text", width: 11 },
          { key: "service", label: "Serviço", type: "text", width: 38 },
          { key: "parts", label: "Peças", type: "text", width: 44 },
          { key: "mechanic", label: "Responsável", type: "text", width: 24 },
          { key: "total", label: "Valor", type: "money" },
        ],
        rows,
        totals: { total: sum(rows, "total") },
      };
    }
  }
}
