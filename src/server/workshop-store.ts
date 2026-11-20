import "server-only";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type { Database, ID } from "@/domain/types";
import { type CommandBatch, replayCommands } from "@/services/commands";
import { DomainError, membershipOf } from "@/services/core";
import { transaction, withConnection } from "./db";
import { hashSecret, isHashed } from "./secrets";

/**
 * Dados de uma oficina no servidor (decisão 96).
 *
 * Escrita: trava a oficina, repete as ações com nome sobre os dados atuais
 * (mesmas regras de `src/services`), grava só os registros que mudaram e sobe
 * a versão. A tela recebe as mudanças e a versão nova.
 */

/** Listas guardadas em `records`, uma linha por item. */
export const KINDS = [
  "workshops", "settings", "memberships", "customers", "vehicles", "orders", "orderItems", "orderEvents",
  "orderPhotos", "parts", "stockMovements", "appointments", "transactions", "payments",
] as const;
type Kind = (typeof KINDS)[number];
type Row = { id: ID; workshopId?: ID };

/** Chave de cada registro (as configurações são uma por oficina e não têm id). */
const keyOf = (kind: Kind | "users", item: Row): ID => (kind === "settings" ? item.workshopId! : item.id);

/** Contador do nº do serviço: guardado como um registro a mais. */
const COUNTER = "counter";

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

async function load(c: PoolConnection, workshopId: ID): Promise<Database> {
  const db = emptyDatabase();
  const [rows] = await c.query<RowDataPacket[]>("SELECT kind, data FROM records WHERE workshop_id = ? ORDER BY seq", [workshopId]);
  for (const r of rows) {
    if (r.kind === COUNTER) db.orderCounters[workshopId] = Number(JSON.parse(r.data));
    else if ((KINDS as readonly string[]).includes(r.kind)) (db[r.kind as Kind] as Row[]).push(JSON.parse(r.data));
  }
  const ids = [...new Set(db.memberships.map((m) => m.userId))];
  if (ids.length) {
    const [users] = await c.query<RowDataPacket[]>("SELECT data FROM users WHERE id IN (?)", [ids]);
    db.users = users.map((u) => JSON.parse(u.data));
  }
  return db;
}

/** Cópia em memória da última versão de cada oficina (evita reler tudo a cada ação). */
const cache = new Map<ID, { version: number; db: Database }>();

async function current(c: PoolConnection, workshopId: ID, version: number): Promise<Database> {
  const hit = cache.get(workshopId);
  if (hit && hit.version === version) return structuredClone(hit.db);
  const db = await load(c, workshopId);
  cache.set(workshopId, { version, db: structuredClone(db) });
  return db;
}

/** O que muda entre dois estados (por id, comparando o conteúdo). */
export function diff(before: Database, after: Database, workshopId: ID): Changes {
  const changes: Changes = { upserts: {}, deletes: {} };
  for (const kind of [...KINDS, "users"] as const) {
    const old = new Map((before[kind] as Row[]).map((x) => [keyOf(kind, x), JSON.stringify(x)]));
    const seen = new Set<ID>();
    for (const item of after[kind] as Row[]) {
      const key = keyOf(kind, item);
      if (typeof key !== "string" || seen.has(key)) throw new DomainError("conflict", "Registro repetido.");
      seen.add(key);
      if (old.get(key) !== JSON.stringify(item)) (changes.upserts[kind] ??= []).push(item);
    }
    if (kind !== "users") for (const id of old.keys()) if (!seen.has(id)) (changes.deletes[kind] ??= []).push(id);
  }
  const counter = after.orderCounters[workshopId];
  if (counter !== before.orderCounters[workshopId]) changes.orderCounter = counter;
  return changes;
}

/** Nunca grava dado de outra oficina, mesmo que uma regra tenha errado. */
function assertOwn(changes: Changes, after: Database, workshopId: ID) {
  for (const kind of KINDS) {
    for (const item of changes.upserts[kind] ?? []) {
      const owner = kind === "workshops" ? item.id : item.workshopId;
      if (owner !== workshopId) throw new DomainError("forbidden", "Operação fora da oficina.");
    }
  }
  const members = new Set(after.memberships.map((m) => m.userId));
  for (const u of changes.upserts.users ?? []) if (!members.has(u.id)) throw new DomainError("forbidden", "Operação fora da oficina.");
}

async function write(c: PoolConnection, workshopId: ID, changes: Changes) {
  for (const kind of KINDS) {
    for (const item of changes.upserts[kind] ?? []) {
      await c.query(
        "INSERT INTO records (workshop_id, kind, id, data) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)",
        [workshopId, kind, keyOf(kind, item), JSON.stringify(item)],
      );
    }
    const gone = changes.deletes[kind];
    if (gone?.length) await c.query("DELETE FROM records WHERE workshop_id = ? AND kind = ? AND id IN (?)", [workshopId, kind, gone]);
  }
  for (const u of (changes.upserts.users ?? []) as unknown as { id: ID; email: string; passwordHash?: string }[]) {
    const { passwordHash: _ignored, ...data } = u;
    void _ignored;
    try {
      await c.query(
        "INSERT INTO users (id, email, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE email = VALUES(email), data = VALUES(data)",
        [u.id, u.email.toLowerCase(), JSON.stringify(data)],
      );
    } catch (e) {
      if ((e as { code?: string }).code === "ER_DUP_ENTRY") throw new DomainError("conflict", "Esse e-mail já está em uso por outra pessoa.");
      throw e;
    }
  }
  if (changes.orderCounter !== undefined) {
    await c.query(
      "INSERT INTO records (workshop_id, kind, id, data) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)",
      [workshopId, COUNTER, workshopId, JSON.stringify(changes.orderCounter)],
    );
  }
}

/** PIN nunca fica em texto: o que a regra gravou vira resumo antes de salvar. */
function hashNewPins(db: Database) {
  for (const m of db.memberships) if (m.pin && !isHashed(m.pin)) m.pin = hashSecret(m.pin);
}

/** O que pode ir para o navegador: sem resumo de senha nem de PIN. */
export function stripSecrets<T extends Changes | Database>(value: T): T {
  const out = structuredClone(value);
  const lists = "upserts" in out ? [out.upserts.users, out.upserts.memberships] : [(out as Database).users, (out as Database).memberships];
  for (const list of lists) {
    (list as { passwordHash?: string; pin?: string }[] | undefined)?.forEach((x) => {
      delete x.passwordHash;
      delete x.pin;
    });
  }
  return out;
}

async function lockTenant(c: PoolConnection, workshopId: ID): Promise<number> {
  const [rows] = await c.query<RowDataPacket[]>("SELECT version, active FROM tenants WHERE id = ? FOR UPDATE", [workshopId]);
  if (!rows[0] || !rows[0].active) throw new DomainError("forbidden", "Oficina não encontrada ou desativada.");
  return Number(rows[0].version);
}

export interface ApplyResult {
  from: number;
  version: number;
  changes: Changes;
}

/** Aplica um lote de ações de uma pessoa na oficina dela. */
export async function applyBatch(workshopId: ID, userId: ID, batch: CommandBatch): Promise<ApplyResult> {
  let saved: { version: number; db: Database } | null = null;
  const result = await transaction(async (c) => {
    const from = await lockTenant(c, workshopId);
    const before = await current(c, workshopId, from);
    const after = structuredClone(before);
    replayCommands(after, { workshopId, userId, now: new Date() }, batch);
    hashNewPins(after);
    const changes = diff(before, after, workshopId);
    assertOwn(changes, after, workshopId);
    await write(c, workshopId, changes);
    await c.query("UPDATE tenants SET version = ? WHERE id = ?", [from + 1, workshopId]);
    saved = { version: from + 1, db: after };
    return { from, version: from + 1, changes: stripSecrets(changes) };
  });
  if (saved) cache.set(workshopId, saved);
  return result;
}

/** Tudo da oficina para a tela (só para quem é dela). `null` = nada mudou desde `since`. */
export async function readState(workshopId: ID, userId: ID, since?: number): Promise<{ version: number; db: Database } | null> {
  return withConnection(async (c) => {
    const [rows] = await c.query<RowDataPacket[]>("SELECT version, active FROM tenants WHERE id = ?", [workshopId]);
    if (!rows[0] || !rows[0].active) throw new DomainError("forbidden", "Oficina não encontrada ou desativada.");
    const version = Number(rows[0].version);
    if (since === version) return null;
    const db = await current(c, workshopId, version);
    if (!membershipOf(db, { workshopId, userId })) throw new DomainError("forbidden", "Você não tem acesso a esta oficina.");
    return { version, db: stripSecrets(db) };
  });
}

/** Grava uma oficina inteira de uma vez (criação pela GAVYO). */
export async function insertWorkshop(db: Database, workshopId: ID, passwords: Record<ID, string>): Promise<void> {
  hashNewPins(db);
  await transaction(async (c) => {
    await c.query("INSERT INTO tenants (id, version) VALUES (?, 1)", [workshopId]);
    await write(c, workshopId, diff(emptyDatabase(), db, workshopId));
    for (const [userId, password] of Object.entries(passwords)) {
      await c.query("UPDATE users SET password_hash = ? WHERE id = ?", [hashSecret(password), userId]);
    }
  });
  cache.delete(workshopId);
}

/** Só para os testes. */
export function clearCache() {
  cache.clear();
}
