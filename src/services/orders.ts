import { z } from "zod";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/domain/labels";
import type {
  Database,
  ID,
  OrderStatus,
  PaymentMethod,
  ServiceOrder,
  ServiceOrderItem,
} from "@/domain/types";
import { formatBRL, formatOrderNumber, todayISO } from "@/lib/format";
import { assertCan, can, Ctx, DomainError, findScoped, newId, parse } from "./core";
import { CustomerInput, insertCustomer, upsertVehicle, VehicleInput } from "./customers";
import { applyStockDelta } from "./stock";

/* ---------- Totais e situação financeira ---------- */

export interface OrderTotals {
  laborCents: number | null;
  partsCents: number;
  partsCostCents: number;
  /** Mão de obra (0 quando ainda não informada) + peças. */
  totalCents: number;
  /** A mão de obra ainda não foi informada. */
  laborPending: boolean;
}

export function orderTotals(
  source: { orderItems: ServiceOrderItem[] },
  order: ServiceOrder,
): OrderTotals {
  let partsCents = 0;
  let partsCostCents = 0;
  for (const item of source.orderItems) {
    if (item.orderId !== order.id) continue;
    partsCents += item.quantity * item.unitPriceCents;
    partsCostCents += item.quantity * item.unitCostCents;
  }
  return {
    laborCents: order.laborCents,
    partsCents,
    partsCostCents,
    totalCents: (order.laborCents ?? 0) + partsCents,
    laborPending: order.laborCents === null,
  };
}

export type PaymentSituation = "paid" | "pending" | "undefined" | "free" | "cancelled";

export const PAYMENT_SITUATION_LABELS: Record<PaymentSituation, string> = {
  paid: "Pago",
  pending: "Pagamento pendente",
  undefined: "Valor a definir",
  free: "Sem cobrança",
  cancelled: "Cancelada",
};

export function paymentSituation(order: ServiceOrder, totals: OrderTotals): PaymentSituation {
  if (order.cancelledAt) return "cancelled";
  if (order.paymentId) return "paid";
  if (totals.laborPending) return "undefined";
  if (totals.totalCents === 0) return "free";
  return "pending";
}

function addEvent(db: Database, ctx: Ctx, orderId: ID, message: string) {
  db.orderEvents.push({
    id: newId(),
    workshopId: ctx.workshopId,
    orderId,
    at: ctx.now.toISOString(),
    userId: ctx.userId,
    message,
  });
}

function assertMechanic(db: Database, ctx: Ctx, mechanicId: ID | null) {
  if (!mechanicId) return;
  const ok = db.memberships.some(
    (m) => m.workshopId === ctx.workshopId && m.userId === mechanicId && m.active,
  );
  if (!ok) throw new DomainError("validation", "Responsável inválido para esta oficina.");
}

/* ---------- Criação ---------- */

const itemSchema = z.object({
  partId: z.string(),
  quantity: z.number().int("Quantidade deve ser inteira.").min(1, "Quantidade mínima é 1."),
  unitPriceCents: z.number().int().min(0, "Preço inválido."),
});

const itemsSchema = z
  .array(itemSchema)
  .refine((items) => new Set(items.map((i) => i.partId)).size === items.length, "A mesma peça foi adicionada duas vezes.");

export type OrderItemInput = z.infer<typeof itemSchema>;

const detailsSchema = z.object({
  description: z.string().trim().min(3, "Descreva o serviço."),
  notes: z.string().trim().default(""),
  mechanicId: z.string().nullable(),
  laborCents: z.number().int().min(0, "Valor de mão de obra inválido.").nullable(),
  mileage: z.number().int().min(0, "Quilometragem inválida.").nullable().default(null),
});

export type OrderDetailsInput = z.input<typeof detailsSchema>;

export interface CreateOrderInput extends OrderDetailsInput {
  customer: { id: ID } | CustomerInput;
  vehicle: { id: ID } | VehicleInput;
  items: OrderItemInput[];
  appointmentId?: ID | null;
}

export function createOrder(db: Database, ctx: Ctx, input: CreateOrderInput): ServiceOrder {
  assertCan(db, ctx, "os.create");
  const details = parse(detailsSchema, input);
  const items = parse(itemsSchema, input.items);
  assertMechanic(db, ctx, details.mechanicId);

  const appointment = input.appointmentId
    ? findScoped(db.appointments, ctx, input.appointmentId, "Agendamento não encontrado.")
    : null;
  if (appointment?.orderId) {
    throw new DomainError("conflict", "Este agendamento já foi convertido em OS.");
  }
  if (appointment?.status === "cancelled") {
    throw new DomainError("conflict", "Agendamento cancelado não pode ser convertido em OS.");
  }

  const customer =
    "id" in input.customer
      ? findScoped(db.customers, ctx, input.customer.id, "Cliente não encontrado.")
      : insertCustomer(db, ctx, input.customer);
  let vehicle;
  if ("id" in input.vehicle) {
    vehicle = findScoped(db.vehicles, ctx, input.vehicle.id, "Veículo não encontrado.");
    if (vehicle.customerId !== customer.id) {
      throw new DomainError("validation", "O veículo selecionado não pertence a este cliente.");
    }
    if (details.mileage !== null) vehicle.mileage = Math.max(vehicle.mileage ?? 0, details.mileage);
  } else {
    vehicle = upsertVehicle(db, ctx, customer.id, input.vehicle);
  }

  const number = db.orderCounters[ctx.workshopId] ?? 1;
  db.orderCounters[ctx.workshopId] = number + 1;

  const order: ServiceOrder = {
    id: newId(),
    workshopId: ctx.workshopId,
    number,
    customerId: customer.id,
    vehicleId: vehicle.id,
    description: details.description,
    notes: details.notes,
    mechanicId: details.mechanicId,
    laborCents: details.laborCents,
    mileage: details.mileage ?? ("id" in input.vehicle ? null : (input.vehicle.mileage ?? null)),
    status: "waiting",
    openedAt: ctx.now.toISOString(),
    completedAt: null,
    cancelledAt: null,
    cancelReason: null,
    paymentId: null,
    appointmentId: appointment?.id ?? null,
  };
  db.orders.push(order);
  addEvent(db, ctx, order.id, "OS aberta.");

  const label = formatOrderNumber(number);
  for (const item of items) {
    const part = findScoped(db.parts, ctx, item.partId, "Peça não encontrada.");
    applyStockDelta(db, ctx, part.id, -item.quantity, "order_out", `Uso na ${label}`, order.id);
    db.orderItems.push({
      id: newId(),
      workshopId: ctx.workshopId,
      orderId: order.id,
      partId: part.id,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      unitCostCents: part.costCents,
    });
  }

  if (appointment) {
    appointment.orderId = order.id;
    appointment.status = "attended";
  }
  return order;
}

/* ---------- Edição ---------- */

function getEditable(db: Database, ctx: Ctx, orderId: ID): ServiceOrder {
  const order = findScoped(db.orders, ctx, orderId, "Ordem de serviço não encontrada.");
  if (order.cancelledAt) throw new DomainError("conflict", "Esta OS está cancelada e não pode ser alterada.");
  return order;
}

export function updateOrder(db: Database, ctx: Ctx, orderId: ID, input: OrderDetailsInput): ServiceOrder {
  assertCan(db, ctx, "os.edit");
  const order = getEditable(db, ctx, orderId);
  const details = parse(detailsSchema, input);
  assertMechanic(db, ctx, details.mechanicId);
  if (order.paymentId && details.laborCents !== order.laborCents) {
    throw new DomainError("conflict", "Esta OS já foi paga; o valor não pode mais ser alterado.");
  }
  const changes: string[] = [];
  if (details.laborCents !== order.laborCents) {
    changes.push(
      `mão de obra: ${details.laborCents === null ? "a definir" : formatBRL(details.laborCents)}`,
    );
  }
  if (details.mechanicId !== order.mechanicId) changes.push("responsável alterado");
  if (details.description !== order.description) changes.push("descrição atualizada");
  Object.assign(order, details);
  addEvent(db, ctx, order.id, changes.length ? `OS editada (${changes.join("; ")}).` : "OS editada.");
  return order;
}

/**
 * Substitui a lista de peças da OS movimentando no estoque apenas a diferença.
 * OS concluída exige `correctionReason` (procedimento explícito de correção).
 */
export function setOrderItems(
  db: Database,
  ctx: Ctx,
  orderId: ID,
  input: OrderItemInput[],
  correctionReason?: string,
): void {
  assertCan(db, ctx, "os.parts", "os.edit");
  const order = getEditable(db, ctx, orderId);
  const items = parse(itemsSchema, input);
  if (order.paymentId) {
    throw new DomainError("conflict", "Esta OS já foi paga; as peças não podem mais ser alteradas.");
  }
  const reason = correctionReason?.trim() ?? "";
  if (order.status === "done" && reason.length < 5) {
    throw new DomainError(
      "validation",
      "Esta OS está concluída. Informe o motivo da correção de peças para continuar.",
    );
  }
  const label = formatOrderNumber(order.number);
  const suffix = order.status === "done" ? ` — correção: ${reason}` : "";
  const current = db.orderItems.filter((i) => i.orderId === order.id);
  let changed = false;

  // Saídas primeiro falham cedo sem deixar devoluções aplicadas pela metade:
  // a operação inteira roda sobre uma cópia do banco e só é confirmada se concluir.
  for (const existing of current) {
    const next = items.find((i) => i.partId === existing.partId);
    if (!next) {
      applyStockDelta(db, ctx, existing.partId, existing.quantity, "return", `Peça removida da ${label}${suffix}`, order.id);
      db.orderItems = db.orderItems.filter((i) => i.id !== existing.id);
      changed = true;
      continue;
    }
    const diff = next.quantity - existing.quantity;
    if (diff > 0) {
      applyStockDelta(db, ctx, existing.partId, -diff, "order_out", `Quantidade aumentada na ${label}${suffix}`, order.id);
    } else if (diff < 0) {
      applyStockDelta(db, ctx, existing.partId, -diff, "return", `Quantidade reduzida na ${label}${suffix}`, order.id);
    }
    if (diff !== 0 || next.unitPriceCents !== existing.unitPriceCents) changed = true;
    existing.quantity = next.quantity;
    existing.unitPriceCents = next.unitPriceCents;
  }
  for (const next of items) {
    if (current.some((c) => c.partId === next.partId)) continue;
    const part = findScoped(db.parts, ctx, next.partId, "Peça não encontrada.");
    applyStockDelta(db, ctx, part.id, -next.quantity, "order_out", `Uso na ${label}${suffix}`, order.id);
    db.orderItems.push({
      id: newId(),
      workshopId: ctx.workshopId,
      orderId: order.id,
      partId: part.id,
      quantity: next.quantity,
      unitPriceCents: next.unitPriceCents,
      unitCostCents: part.costCents,
    });
    changed = true;
  }
  if (changed) {
    addEvent(db, ctx, order.id, order.status === "done" ? `Peças corrigidas após conclusão: ${reason}` : "Peças atualizadas.");
  }
}

/* ---------- Status ---------- */

export function canChangeStatus(
  db: Database,
  ctx: Pick<Ctx, "workshopId" | "userId">,
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  if (from === "done" || to === "done") return can(db, ctx, "os.complete");
  return can(db, ctx, "os.status") || can(db, ctx, "os.complete");
}

export function changeOrderStatus(db: Database, ctx: Ctx, orderId: ID, status: OrderStatus): void {
  const order = getEditable(db, ctx, orderId);
  if (order.status === status) return;
  if (order.status === "done" || status === "done") assertCan(db, ctx, "os.complete");
  else assertCan(db, ctx, "os.status", "os.complete");
  if (order.status === "done" && order.paymentId) {
    throw new DomainError("conflict", "Esta OS já foi paga e não pode ser reaberta.");
  }
  order.status = status;
  // Concluir NÃO movimenta estoque: a baixa ocorreu quando as peças foram adicionadas.
  order.completedAt = status === "done" ? ctx.now.toISOString() : null;
  addEvent(db, ctx, order.id, `Status alterado para ${ORDER_STATUS_LABELS[status]}.`);
}

export function cancelOrder(
  db: Database,
  ctx: Ctx,
  orderId: ID,
  input: { reason: string; returnParts: boolean },
): void {
  assertCan(db, ctx, "os.cancel");
  const order = getEditable(db, ctx, orderId);
  if (order.paymentId) throw new DomainError("conflict", "Uma OS paga não pode ser cancelada.");
  if (order.status === "done") {
    throw new DomainError("conflict", "Reabra a OS antes de cancelar um serviço já concluído.");
  }
  const reason = input.reason.trim();
  if (reason.length < 3) throw new DomainError("validation", "Informe o motivo do cancelamento.");
  const label = formatOrderNumber(order.number);
  if (input.returnParts) {
    for (const item of db.orderItems.filter((i) => i.orderId === order.id)) {
      applyStockDelta(db, ctx, item.partId, item.quantity, "return", `Cancelamento da ${label}`, order.id);
    }
  }
  order.cancelledAt = ctx.now.toISOString();
  order.cancelReason = reason;
  addEvent(
    db,
    ctx,
    order.id,
    `OS cancelada: ${reason}. ${input.returnParts ? "Peças devolvidas ao estoque." : "Peças não devolvidas ao estoque."}`,
  );
}

/* ---------- Pagamento ---------- */

/**
 * Pagamento integral. Cria Payment + receita de forma atômica e única por OS.
 * No backend real: transação MySQL + índice único em Payment(orderId).
 */
export function registerPayment(
  db: Database,
  ctx: Ctx,
  orderId: ID,
  input: { method: PaymentMethod },
): void {
  assertCan(db, ctx, "finance.payment");
  const order = getEditable(db, ctx, orderId);
  if (order.paymentId || db.payments.some((p) => p.orderId === order.id)) {
    throw new DomainError("conflict", "O pagamento desta OS já foi registrado.");
  }
  if (!(input.method in PAYMENT_METHOD_LABELS)) {
    throw new DomainError("validation", "Forma de pagamento inválida.");
  }
  const totals = orderTotals(db, order);
  if (totals.laborPending) {
    throw new DomainError("validation", "Informe o valor da mão de obra antes de registrar o pagamento.");
  }
  if (totals.totalCents <= 0) {
    throw new DomainError("validation", "Esta OS não possui valor a receber.");
  }
  const paymentId = newId();
  db.payments.push({
    id: paymentId,
    workshopId: ctx.workshopId,
    orderId: order.id,
    amountCents: totals.totalCents,
    method: input.method,
    paidAt: ctx.now.toISOString(),
    userId: ctx.userId,
  });
  db.transactions.push({
    id: newId(),
    workshopId: ctx.workshopId,
    kind: "income",
    description: `Pagamento da ${formatOrderNumber(order.number)}`,
    category: "Ordem de serviço",
    amountCents: totals.totalCents,
    date: todayISO(ctx.now),
    method: input.method,
    status: "paid",
    customerId: order.customerId,
    orderId: order.id,
    paymentId,
    notes: "",
    userId: ctx.userId,
  });
  order.paymentId = paymentId;
  addEvent(db, ctx, order.id, `Pagamento de ${formatBRL(totals.totalCents)} registrado via ${PAYMENT_METHOD_LABELS[input.method]}.`);
}
