import type { Database, ID } from "@/domain/types";

/**
 * Formato das mudanças que o servidor devolve depois de gravar (decisão 96),
 * usado dos dois lados: o servidor calcula, a tela aplica sobre a versão dela.
 */

/** Listas da oficina guardadas uma linha por item. */
export const KINDS = [
  "workshops", "settings", "memberships", "customers", "vehicles", "orders", "orderItems", "orderEvents",
  "orderPhotos", "parts", "stockMovements", "appointments", "transactions", "payments",
] as const;
export type Kind = (typeof KINDS)[number];
export type Row = { id: ID; workshopId?: ID };

/** Chave de cada registro (as configurações são uma por oficina e não têm id). */
export const keyOf = (kind: Kind | "users", item: Row): ID => (kind === "settings" ? item.workshopId! : item.id);

export interface Changes {
  upserts: Partial<Record<Kind | "users", Row[]>>;
  deletes: Partial<Record<Kind, ID[]>>;
  orderCounter?: number;
}

export function emptyDatabase(): Database {
  return {
    version: 1, workshops: [], settings: [], users: [], memberships: [], customers: [], vehicles: [], orders: [],
    orderItems: [], orderEvents: [], orderPhotos: [], parts: [], stockMovements: [], appointments: [],
    transactions: [], payments: [], orderCounters: {},
  };
}

/** Aplica as mudanças sobre uma cópia (registros novos entram no fim, como no servidor). */
export function applyChanges(db: Database, changes: Changes, workshopId: ID): Database {
  const out = structuredClone(db);
  for (const kind of [...KINDS, "users"] as const) {
    const list = out[kind] as Row[];
    for (const item of changes.upserts[kind] ?? []) {
      const i = list.findIndex((x) => keyOf(kind, x) === keyOf(kind, item));
      if (i >= 0) list[i] = item;
      else list.push(item);
    }
    if (kind !== "users") {
      const gone = new Set(changes.deletes[kind] ?? []);
      if (gone.size) (out[kind] as Row[]) = list.filter((x) => !gone.has(keyOf(kind, x)));
    }
  }
  if (changes.orderCounter !== undefined) out.orderCounters[workshopId] = changes.orderCounter;
  return out;
}
