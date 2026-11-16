import { z } from "zod";
import type { Database, ID, PermissionKey, WorkshopMembership } from "@/domain/types";

/**
 * Contexto de execução de uma operação.
 *
 * Na demonstração ele vem da sessão fictícia. No backend real será montado
 * EXCLUSIVAMENTE no servidor a partir da sessão autenticada — nunca a partir
 * de um workshopId enviado pelo navegador.
 */
export interface Ctx {
  workshopId: ID;
  userId: ID;
  now: Date;
}

export type DomainErrorCode =
  | "forbidden"
  | "validation"
  | "not_found"
  | "conflict"
  | "offline"
  | "unavailable";

export class DomainError extends Error {
  constructor(
    public code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function newId(): ID {
  return crypto.randomUUID();
}

export function membershipOf(db: Database, ctx: Pick<Ctx, "workshopId" | "userId">): WorkshopMembership | undefined {
  return db.memberships.find(
    (m) => m.workshopId === ctx.workshopId && m.userId === ctx.userId && m.active,
  );
}

export function can(db: Database, ctx: Pick<Ctx, "workshopId" | "userId">, permission: PermissionKey): boolean {
  return membershipOf(db, ctx)?.permissions.includes(permission) ?? false;
}

/** Exige ao menos uma das permissões. Toda operação de escrita passa por aqui. */
export function assertCan(db: Database, ctx: Ctx, ...anyOf: PermissionKey[]): void {
  if (!membershipOf(db, ctx)) {
    throw new DomainError("forbidden", "Você não tem acesso a esta oficina.");
  }
  if (!anyOf.some((p) => can(db, ctx, p))) {
    throw new DomainError("forbidden", "Você não tem permissão para realizar esta ação.");
  }
}

/** Valida a entrada com Zod e converte o primeiro problema em DomainError. */
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new DomainError("validation", result.error.issues[0]?.message ?? "Dados inválidos.");
  }
  return result.data;
}

/** Busca um registro garantindo que pertence à oficina do contexto. */
export function findScoped<T extends { id: ID; workshopId: ID }>(
  list: T[],
  ctx: Ctx,
  id: ID,
  notFoundMessage: string,
): T {
  const item = list.find((x) => x.id === id && x.workshopId === ctx.workshopId);
  if (!item) throw new DomainError("not_found", notFoundMessage);
  return item;
}

/** Visão do banco restrita a uma oficina — único caminho de leitura usado pela interface. */
export function scopeTo(db: Database, workshopId: ID) {
  const own = <T extends { workshopId: ID }>(list: T[]) =>
    list.filter((x) => x.workshopId === workshopId);
  const memberships = own(db.memberships);
  const memberIds = new Set(memberships.map((m) => m.userId));
  return {
    workshop: db.workshops.find((w) => w.id === workshopId),
    settings: db.settings.find((s) => s.workshopId === workshopId),
    memberships,
    users: db.users.filter((u) => memberIds.has(u.id)),
    customers: own(db.customers),
    vehicles: own(db.vehicles),
    orders: own(db.orders),
    orderItems: own(db.orderItems),
    orderEvents: own(db.orderEvents),
    parts: own(db.parts),
    stockMovements: own(db.stockMovements),
    appointments: own(db.appointments),
    transactions: own(db.transactions),
    payments: own(db.payments),
  };
}

export type WorkshopView = ReturnType<typeof scopeTo>;
