import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import type { ID } from "@/domain/types";
import { passwordSchema } from "@/services/auth";
import { DomainError, parse } from "@/services/core";
import { transaction, withConnection } from "./db";
import { hashSecret } from "./secrets";

/**
 * Tela interna da GAVYO (decisão 98). Entra com a chave GAVYO_ADMIN_KEY do
 * servidor; o navegador recebe um cookie assinado que vale 8 horas.
 * 5 chaves erradas seguidas = 15 minutos de espera.
 */
export const ADMIN_COOKIE = "gv_adm";
const HOURS = 8;

function adminKey(): string {
  const key = process.env.GAVYO_ADMIN_KEY ?? "";
  return key.length >= 24 ? key : "";
}

function sign(exp: number): string {
  return createHmac("sha256", adminKey()).update(`gavyo-admin:${exp}`).digest("base64url");
}

function same(a: string, b: string): boolean {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Confere a chave digitada (com bloqueio) e devolve o cookie. */
export async function adminLogin(key: string): Promise<{ cookie: string; maxAge: number }> {
  const real = adminKey();
  if (!real) throw new DomainError("unavailable", "A chave da GAVYO não está configurada no servidor.");
  return withConnection(async (c) => {
    const [rows] = await c.query<RowDataPacket[]>("SELECT 1 FROM attempts WHERE k = 'admin' AND blocked_until > UTC_TIMESTAMP()");
    if (rows.length) throw new DomainError("forbidden", "Muitas tentativas erradas. Espere 15 minutos.");
    if (typeof key !== "string" || !same(key.trim(), real)) {
      await c.query(
        `INSERT INTO attempts (k, fails) VALUES ('admin', 1)
         ON DUPLICATE KEY UPDATE fails = IF(blocked_until IS NOT NULL AND blocked_until <= UTC_TIMESTAMP(), 1, fails + 1),
           blocked_until = IF(fails >= 5, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE), IF(blocked_until <= UTC_TIMESTAMP(), NULL, blocked_until))`,
      );
      throw new DomainError("forbidden", "Chave errada.");
    }
    await c.query("DELETE FROM attempts WHERE k = 'admin'");
    const exp = Date.now() + HOURS * 3_600_000;
    return { cookie: `${exp}.${sign(exp)}`, maxAge: HOURS * 3_600 };
  });
}

/** Cookie da tela da GAVYO ou cabeçalho `Authorization: Bearer <chave>` (para scripts). */
export function isAdmin(cookie: string | undefined, authorization: string | null): boolean {
  const real = adminKey();
  if (!real) return false;
  const bearer = (authorization ?? "").replace(/^Bearer /, "");
  if (bearer && same(bearer, real)) return true;
  if (!cookie) return false;
  const [exp, sig] = cookie.split(".");
  return Number(exp) > Date.now() && !!sig && same(sig, sign(Number(exp)));
}

export interface WorkshopRow {
  id: ID;
  name: string;
  phone: string;
  createdAt: string;
  active: boolean;
  owner: { id: ID; name: string; email: string } | null;
  people: number;
  devices: number;
  lastUse: string | null;
}

/** Todas as oficinas, a mais nova primeiro. */
export async function listWorkshops(): Promise<WorkshopRow[]> {
  return withConnection(async (c) => {
    const [tenants] = await c.query<RowDataPacket[]>(
      `SELECT t.id, t.active, t.created_at,
         (SELECT COUNT(*) FROM devices d WHERE d.workshop_id = t.id) AS devices,
         (SELECT MAX(d.last_seen) FROM devices d WHERE d.workshop_id = t.id) AS last_use
       FROM tenants t ORDER BY t.created_at DESC`,
    );
    if (!tenants.length) return [];
    const ids = tenants.map((t) => t.id);
    const [records] = await c.query<RowDataPacket[]>(
      "SELECT workshop_id, kind, data FROM records WHERE workshop_id IN (?) AND kind IN ('workshops', 'settings', 'memberships')",
      [ids],
    );
    const owners = records.filter((r) => r.kind === "memberships").map((r) => ({ ws: r.workshop_id as ID, m: JSON.parse(r.data) }));
    const ownerIds = [...new Set(owners.filter((o) => o.m.role === "owner").map((o) => o.m.userId as ID))];
    const [users] = ownerIds.length ? await c.query<RowDataPacket[]>("SELECT id, data FROM users WHERE id IN (?)", [ownerIds]) : [[] as RowDataPacket[]];
    const userById = new Map(users.map((u) => [u.id as ID, JSON.parse(u.data) as { name: string; email: string }]));
    return tenants.map((t) => {
      const mine = records.filter((r) => r.workshop_id === t.id);
      const w = mine.find((r) => r.kind === "workshops");
      const s = mine.find((r) => r.kind === "settings");
      const members = owners.filter((o) => o.ws === t.id && o.m.active);
      const ownerM = members.find((o) => o.m.role === "owner");
      const ownerU = ownerM ? userById.get(ownerM.m.userId) : undefined;
      return {
        id: t.id,
        name: w ? JSON.parse(w.data).name : t.id,
        phone: s ? JSON.parse(s.data).phone ?? "" : "",
        createdAt: String(t.created_at),
        active: !!t.active,
        owner: ownerM && ownerU ? { id: ownerM.m.userId, name: ownerU.name, email: ownerU.email } : null,
        people: members.length,
        devices: Number(t.devices),
        lastUse: t.last_use ? String(t.last_use) : null,
      };
    });
  });
}

/** "Esqueci a senha": a GAVYO cria outra. Desconecta os aparelhos (quem tinha a senha antiga sai). */
export async function resetOwnerPassword(workshopId: ID, password: string): Promise<void> {
  const value = parse(passwordSchema, password);
  const owner = (await listWorkshops()).find((w) => w.id === workshopId)?.owner;
  if (!owner) throw new DomainError("not_found", "Oficina sem dono ativo.");
  const hash = await hashSecret(value);
  await transaction(async (c) => {
    await c.query("UPDATE users SET password_hash = ? WHERE id = ?", [hash, owner.id]);
    await c.query("DELETE FROM attempts WHERE k = ?", [`pw:${owner.email.toLowerCase()}`]);
    // Quem tinha a senha antiga sai: todo aparelho da oficina volta a pedir e-mail e senha.
    await c.query("DELETE FROM sessions WHERE workshop_id = ?", [workshopId]);
    await c.query("DELETE FROM devices WHERE workshop_id = ?", [workshopId]);
  });
}

/** Desativar: ninguém entra e os aparelhos são desconectados. Os dados ficam guardados. */
export async function setWorkshopActive(workshopId: ID, active: boolean): Promise<void> {
  await transaction(async (c) => {
    const [r] = await c.query<RowDataPacket[]>("SELECT 1 FROM tenants WHERE id = ?", [workshopId]);
    if (!r.length) throw new DomainError("not_found", "Oficina não encontrada.");
    await c.query("UPDATE tenants SET active = ? WHERE id = ?", [active ? 1 : 0, workshopId]);
    if (!active) {
      await c.query("DELETE FROM sessions WHERE workshop_id = ?", [workshopId]);
      await c.query("DELETE FROM devices WHERE workshop_id = ?", [workshopId]);
    }
  });
}
