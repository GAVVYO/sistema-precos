import "server-only";
import mysql, { type Pool, type PoolConnection } from "mysql2/promise";
import { SCHEMA } from "./schema";

/**
 * Conexão com o MySQL (Fase 2). A senha vem só da variável DATABASE_URL do
 * servidor (mysql://usuario:senha@127.0.0.1:3306/banco) — nunca do código.
 * Na Hostinger o app fala com 127.0.0.1 (o MySQL roda na mesma máquina).
 */
let pool: Pool | null = null;
let ready: Promise<void> | null = null;

export function getPool(): Pool {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada.");
  pool = mysql.createPool({ uri: url, connectionLimit: 5, charset: "utf8mb4", timezone: "Z", dateStrings: true });
  return pool;
}

/** Cria as tabelas que faltam (idempotente). Roda uma vez por processo. */
export function ensureSchema(): Promise<void> {
  ready ??= (async () => {
    const p = getPool();
    for (const sql of SCHEMA) await p.query(sql);
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

export async function withConnection<T>(fn: (c: PoolConnection) => Promise<T>): Promise<T> {
  await ensureSchema();
  const c = await getPool().getConnection();
  try {
    return await fn(c);
  } finally {
    c.release();
  }
}

/** Transação: confirma se `fn` terminar, desfaz tudo se der erro. */
export async function transaction<T>(fn: (c: PoolConnection) => Promise<T>): Promise<T> {
  return withConnection(async (c) => {
    await c.beginTransaction();
    try {
      const value = await fn(c);
      await c.commit();
      return value;
    } catch (e) {
      await c.rollback().catch(() => {});
      throw e;
    }
  });
}

/** Só para os testes: fecha a conexão e esquece o estado. */
export async function closePool(): Promise<void> {
  await pool?.end();
  pool = null;
  ready = null;
}
