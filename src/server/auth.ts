import "server-only";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type { ID, Role, WorkshopMembership } from "@/domain/types";
import { emailSchema } from "@/services/auth";
import { DomainError } from "@/services/core";
import { transaction, withConnection } from "./db";
import { checkSecret, newToken, tokenHash } from "./secrets";

/**
 * Entrada no servidor (decisões 74–75 e 96), igual à da demonstração:
 * 1. O DONO conecta o aparelho com e-mail e senha (criados pela GAVYO).
 *    O aparelho guarda uma ficha (cookie httpOnly) por até 400 dias.
 * 2. Em "Quem está entrando?", cada pessoa toca no nome e digita o PIN.
 *    A sessão vale 12 horas no aparelho.
 * Erros repetidos bloqueiam por um tempo (senha: 5 erros = 15 min; PIN: 5 erros = 5 min).
 */

export const SESSION_HOURS = 12;
const PASSWORD_LIMIT = { fails: 5, minutes: 15 };
const PIN_LIMIT = { fails: 5, minutes: 5 };

async function blocked(c: PoolConnection, key: string): Promise<number> {
  const [rows] = await c.query<RowDataPacket[]>(
    "SELECT TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), blocked_until) AS s FROM attempts WHERE k = ? AND blocked_until > UTC_TIMESTAMP()",
    [key],
  );
  return rows[0] ? Number(rows[0].s) : 0;
}

async function failed(c: PoolConnection, key: string, limit: { fails: number; minutes: number }) {
  await c.query(
    `INSERT INTO attempts (k, fails) VALUES (?, 1)
     ON DUPLICATE KEY UPDATE fails = IF(blocked_until IS NOT NULL AND blocked_until <= UTC_TIMESTAMP(), 1, fails + 1),
       blocked_until = IF(fails >= ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE), IF(blocked_until <= UTC_TIMESTAMP(), NULL, blocked_until))`,
    [key, limit.fails, limit.minutes],
  );
}

function waitMessage(seconds: number): string {
  const min = Math.max(1, Math.ceil(seconds / 60));
  return `Muitas tentativas erradas. Espere ${min} ${min === 1 ? "minuto" : "minutos"} e tente de novo.`;
}

async function memberships(c: PoolConnection, workshopId: ID): Promise<WorkshopMembership[]> {
  const [rows] = await c.query<RowDataPacket[]>("SELECT data FROM records WHERE workshop_id = ? AND kind = 'memberships' ORDER BY seq", [workshopId]);
  return rows.map((r) => JSON.parse(r.data));
}

/** Passo 1: o dono conecta o aparelho. Devolve a ficha do aparelho. */
export async function connectDevice(rawEmail: string, password: string): Promise<{ token: string; workshopId: ID; workshopName: string; userId: ID }> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success || typeof password !== "string" || !password) throw new DomainError("validation", "Digite o e-mail e a senha.");
  const email = parsed.data;
  // Sem transação: a tentativa errada precisa ficar gravada mesmo com o erro.
  return withConnection(async (c) => {
    const key = `pw:${email}`;
    const wait = await blocked(c, key);
    if (wait) throw new DomainError("forbidden", waitMessage(wait));
    const [users] = await c.query<RowDataPacket[]>("SELECT id, password_hash FROM users WHERE email = ?", [email]);
    const user = users[0];
    // Sem usuário confere contra um resumo falso: a resposta demora o mesmo que senha errada.
    if (!(await checkSecret(password, user?.password_hash)) || !user) {
      await failed(c, key, PASSWORD_LIMIT);
      throw new DomainError("forbidden", "E-mail ou senha não conferem.");
    }
    const [rows] = await c.query<RowDataPacket[]>(
      `SELECT r.workshop_id, r.data, t.active FROM records r JOIN tenants t ON t.id = r.workshop_id
       WHERE r.kind = 'memberships' AND JSON_VALUE(r.data, '$.userId') = ? ORDER BY r.seq`,
      [user.id],
    );
    const owned = rows.filter((r) => {
      const m = JSON.parse(r.data) as WorkshopMembership;
      return m.userId === user.id && m.role === "owner" && m.active;
    });
    const ws = owned.find((o) => o.active);
    if (!ws) throw new DomainError("forbidden", "Só o dono da oficina conecta um aparelho. Peça para o dono entrar aqui.");
    await c.query("DELETE FROM attempts WHERE k = ?", [key]);
    const token = newToken();
    await c.query("INSERT INTO devices (token_hash, workshop_id, connected_by) VALUES (?, ?, ?)", [tokenHash(token), ws.workshop_id, user.id]);
    const [names] = await c.query<RowDataPacket[]>("SELECT data FROM records WHERE workshop_id = ? AND kind = 'workshops'", [ws.workshop_id]);
    return { token, workshopId: ws.workshop_id, workshopName: names[0] ? JSON.parse(names[0].data).name : "", userId: user.id as ID };
  });
}

export interface DeviceInfo {
  hash: string;
  workshopId: ID;
}

export async function deviceOf(token: string | undefined): Promise<DeviceInfo | null> {
  if (!token) return null;
  const hash = tokenHash(token);
  return withConnection(async (c) => {
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT d.workshop_id FROM devices d JOIN tenants t ON t.id = d.workshop_id AND t.active = 1 WHERE d.token_hash = ?",
      [hash],
    );
    if (!rows[0]) return null;
    await c.query("UPDATE devices SET last_seen = UTC_TIMESTAMP() WHERE token_hash = ?", [hash]);
    return { hash, workshopId: rows[0].workshop_id };
  });
}

export interface Person {
  userId: ID;
  name: string;
  role: Role;
  photo?: string;
}

/** "Quem está entrando?": só nome, função e foto de quem está ativo. */
export async function peopleOf(device: DeviceInfo): Promise<{ workshopName: string; people: Person[] }> {
  return withConnection(async (c) => {
    const members = (await memberships(c, device.workshopId)).filter((m) => m.active);
    const ids = members.map((m) => m.userId);
    const [users] = ids.length ? await c.query<RowDataPacket[]>("SELECT id, data FROM users WHERE id IN (?)", [ids]) : [[] as RowDataPacket[]];
    const byId = new Map(users.map((u) => [u.id as string, JSON.parse(u.data) as { name: string; photo?: string }]));
    const [names] = await c.query<RowDataPacket[]>("SELECT data FROM records WHERE workshop_id = ? AND kind = 'workshops'", [device.workshopId]);
    return {
      workshopName: names[0] ? JSON.parse(names[0].data).name : "",
      people: members.flatMap((m) => {
        const u = byId.get(m.userId);
        return u ? [{ userId: m.userId, name: u.name, role: m.role, photo: u.photo }] : [];
      }),
    };
  });
}

/** Passo 2: a pessoa digita o PIN. Devolve a ficha da sessão. */
export async function pinLogin(device: DeviceInfo, userId: ID, pin: string): Promise<{ token: string; expiresAt: Date }> {
  if (typeof userId !== "string" || typeof pin !== "string" || !/^\d{4}$/.test(pin)) throw new DomainError("validation", "O PIN tem 4 números.");
  return withConnection(async (c) => {
    const key = `pin:${device.hash}:${userId}`;
    const wait = await blocked(c, key);
    if (wait) throw new DomainError("forbidden", waitMessage(wait));
    const m = (await memberships(c, device.workshopId)).find((x) => x.userId === userId && x.active);
    if (!(await checkSecret(pin, m?.pin)) || !m) {
      await failed(c, key, PIN_LIMIT);
      throw new DomainError("forbidden", "PIN errado. Tente de novo.");
    }
    await c.query("DELETE FROM attempts WHERE k = ?", [key]);
    return openSession(c, device, userId);
  });
}

async function openSession(c: PoolConnection, device: DeviceInfo, userId: ID): Promise<{ token: string; expiresAt: Date }> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3_600_000);
  await c.query("INSERT INTO sessions (token_hash, device_hash, workshop_id, user_id, expires_at) VALUES (?, ?, ?, ?, ?)", [
    tokenHash(token), device.hash, device.workshopId, userId, expiresAt.toISOString().slice(0, 19).replace("T", " "),
  ]);
  return { token, expiresAt };
}

/** O dono acabou de provar a senha: já entra, sem pedir o PIN (igual à demonstração). */
export async function ownerSession(deviceToken: string, workshopId: ID, userId: ID): Promise<{ token: string }> {
  return withConnection((c) => openSession(c, { hash: tokenHash(deviceToken), workshopId }, userId));
}

/** Quem está usando: precisa do aparelho conectado E da sessão dele, ainda válida. */
export async function sessionOf(deviceToken: string | undefined, sessionToken: string | undefined): Promise<{ workshopId: ID; userId: ID } | null> {
  if (!deviceToken || !sessionToken) return null;
  return withConnection(async (c) => {
    const [rows] = await c.query<RowDataPacket[]>(
      `SELECT s.workshop_id, s.user_id FROM sessions s
       JOIN devices d ON d.token_hash = s.device_hash AND d.workshop_id = s.workshop_id
       JOIN tenants t ON t.id = s.workshop_id AND t.active = 1
       WHERE s.token_hash = ? AND s.device_hash = ? AND s.expires_at > UTC_TIMESTAMP()`,
      [tokenHash(sessionToken), tokenHash(deviceToken)],
    );
    if (!rows[0]) return null;
    // Quem perdeu o acesso sai na hora, mesmo com sessão aberta.
    const m = (await memberships(c, rows[0].workshop_id)).find((x) => x.userId === rows[0].user_id && x.active);
    return m ? { workshopId: rows[0].workshop_id, userId: rows[0].user_id } : null;
  });
}

export async function endSession(sessionToken: string | undefined): Promise<void> {
  if (!sessionToken) return;
  await withConnection((c) => c.query("DELETE FROM sessions WHERE token_hash = ?", [tokenHash(sessionToken)]));
}

export async function disconnectDevice(deviceToken: string | undefined): Promise<void> {
  if (!deviceToken) return;
  const hash = tokenHash(deviceToken);
  await transaction(async (c) => {
    await c.query("DELETE FROM sessions WHERE device_hash = ?", [hash]);
    await c.query("DELETE FROM devices WHERE token_hash = ?", [hash]);
  });
}
