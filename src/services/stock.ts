import { z } from "zod";
import type { Database, ID, Part, StockMovementType } from "@/domain/types";
import { assertCan, Ctx, DomainError, findScoped, newId, parse } from "./core";

export type PartSituation = "ok" | "low" | "out";

export function partSituation(part: Pick<Part, "quantity" | "minQuantity">): PartSituation {
  if (part.quantity <= 0) return "out";
  if (part.quantity <= part.minQuantity) return "low";
  return "ok";
}

const partSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da peça."),
  code: z.string().trim().min(1, "Informe o código interno."),
  category: z.string().trim().min(1, "Informe a categoria."),
  description: z.string().trim().default(""),
  minQuantity: z.number().int("Quantidade mínima deve ser inteira.").min(0, "Quantidade mínima inválida."),
  costCents: z.number().int().min(0, "Custo inválido."),
  priceCents: z.number().int().min(0, "Preço de venda inválido."),
  photo: z.string().regex(/^data:image\/(jpeg|png|webp);base64,/, "Arquivo de imagem inválido.").max(700_000, "Foto grande demais. Tente de novo.").nullable().optional(),
});

export type PartInput = z.input<typeof partSchema>;

function assertUniqueCode(db: Database, ctx: Ctx, code: string, ignoreId?: ID) {
  const clash = db.parts.some(
    (p) =>
      p.workshopId === ctx.workshopId &&
      p.id !== ignoreId &&
      p.code.toLowerCase() === code.toLowerCase(),
  );
  if (clash) throw new DomainError("conflict", `Já existe uma peça com o código ${code}.`);
}

/**
 * Único ponto que altera a quantidade de uma peça. Sempre gera movimentação
 * e nunca permite saldo negativo. No backend real, este trecho roda dentro de
 * uma transação MySQL com `SELECT ... FOR UPDATE` na linha da peça.
 */
export function applyStockDelta(
  db: Database,
  ctx: Ctx,
  partId: ID,
  delta: number,
  type: StockMovementType,
  reason: string,
  orderId: ID | null = null,
): void {
  if (delta === 0) return;
  const part = findScoped(db.parts, ctx, partId, "Peça não encontrada.");
  const balance = part.quantity + delta;
  if (balance < 0) {
    throw new DomainError(
      "conflict",
      `Estoque insuficiente de ${part.name}: disponível ${part.quantity}, necessário ${-delta}.`,
    );
  }
  part.quantity = balance;
  db.stockMovements.push({
    id: newId(),
    workshopId: ctx.workshopId,
    partId,
    type,
    delta,
    balanceAfter: balance,
    reason,
    userId: ctx.userId,
    orderId,
    at: ctx.now.toISOString(),
  });
}

export function createPart(db: Database, ctx: Ctx, input: PartInput & { initialQuantity: number }): Part {
  assertCan(db, ctx, "stock.move");
  const data = parse(partSchema, input);
  if (!Number.isInteger(input.initialQuantity) || input.initialQuantity < 0) {
    throw new DomainError("validation", "Quantidade inicial inválida.");
  }
  assertUniqueCode(db, ctx, data.code);
  const part: Part = { id: newId(), workshopId: ctx.workshopId, quantity: 0, ...data };
  db.parts.push(part);
  applyStockDelta(db, ctx, part.id, input.initialQuantity, "in", "Estoque inicial");
  return part;
}

export function updatePart(db: Database, ctx: Ctx, partId: ID, input: PartInput): Part {
  assertCan(db, ctx, "stock.move");
  const part = findScoped(db.parts, ctx, partId, "Peça não encontrada.");
  const data = parse(partSchema, input);
  assertUniqueCode(db, ctx, data.code, partId);
  Object.assign(part, data);
  return part;
}

/** Trocar ou tirar a foto da peça sem abrir o cadastro inteiro (decisão 89). */
export function setPartPhoto(db: Database, ctx: Ctx, partId: ID, photo: string | null): void {
  assertCan(db, ctx, "stock.move");
  const part = findScoped(db.parts, ctx, partId, "Peça não encontrada.");
  part.photo = parse(partSchema.shape.photo, photo) ?? null;
}

const moveSchema = z.object({
  partId: z.string(),
  type: z.enum(["in", "out", "adjust"]),
  quantity: z.number().int("Informe uma quantidade inteira.").min(0, "Quantidade inválida."),
  reason: z.string().trim().min(3, "Informe o motivo da movimentação."),
});

export type MoveInput = z.input<typeof moveSchema>;

/** Entrada, saída manual ou ajuste (no ajuste, `quantity` é o saldo contado). */
export function moveStock(db: Database, ctx: Ctx, input: MoveInput): void {
  assertCan(db, ctx, "stock.move");
  const data = parse(moveSchema, input);
  const part = findScoped(db.parts, ctx, data.partId, "Peça não encontrada.");
  if (data.type === "adjust") {
    if (data.quantity === part.quantity) {
      throw new DomainError("validation", "A quantidade informada é igual ao saldo atual.");
    }
    applyStockDelta(db, ctx, part.id, data.quantity - part.quantity, "adjust", data.reason);
    return;
  }
  if (data.quantity === 0) throw new DomainError("validation", "Informe uma quantidade maior que zero.");
  applyStockDelta(db, ctx, part.id, data.type === "in" ? data.quantity : -data.quantity, data.type, data.reason);
}
