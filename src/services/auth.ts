import { z } from "zod";
import type { Database, ID } from "@/domain/types";
import { DomainError, parse } from "./core";

/**
 * Conectar o aparelho à oficina (decisões 74–75).
 *
 * A GAVYO cria a conta da oficina e entrega ao dono o e-mail e a senha. O dono
 * só entra: e-mail + senha uma vez no aparelho; depois, cada funcionário entra
 * com o PIN. Esqueceu a senha: a GAVYO troca (`setOwnerPassword`).
 *
 * Demonstração: tudo roda no navegador. Fase 2: senha com bcrypt no servidor e
 * limite de tentativas no servidor.
 */

export const emailSchema = z.string().trim().toLowerCase().email("E-mail inválido. Ex.: joao@suaoficina.com");
export const passwordSchema = z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(128, "Senha longa demais.");

export type EmailCheck =
  | { kind: "unknown" }
  | { kind: "not-owner"; name: string }
  | { kind: "owner"; userId: ID; name: string };

/** Oficinas em que a pessoa é dona ativa (só o dono conecta aparelhos). */
export function ownedWorkshops(db: Database, userId: ID): ID[] {
  return db.memberships.filter((m) => m.userId === userId && m.active && m.role === "owner").map((m) => m.workshopId);
}

/** Primeiro passo: de quem é este e-mail e o que vem a seguir. */
export function checkEmail(db: Database, rawEmail: string): EmailCheck {
  const email = parse(emailSchema, rawEmail);
  const user = db.users.find((u) => u.email.toLowerCase() === email);
  if (!user || !db.memberships.some((m) => m.userId === user.id && m.active)) return { kind: "unknown" };
  if (!ownedWorkshops(db, user.id).length) return { kind: "not-owner", name: user.name };
  return { kind: "owner", userId: user.id, name: user.name };
}

/**
 * Resumo da senha. Só para a demonstração (não é seguro contra ataque):
 * na fase 2 a senha nem chega a ser guardada no navegador.
 */
export function demoHash(password: string): string {
  let h = 0x811c9dc5;
  for (const ch of `gavyo:${password}`) h = Math.imul(h ^ ch.codePointAt(0)!, 0x01000193) >>> 0;
  return `demo$${h.toString(16)}`;
}

/** Confere a senha do dono. */
export function checkPassword(db: Database, userId: ID, password: string): boolean {
  const user = db.users.find((u) => u.id === userId);
  return !!user?.passwordHash && user.passwordHash === demoHash(password);
}

/** A GAVYO cria ou troca a senha do dono (cadastro da oficina e "esqueci a senha"). */
export function setOwnerPassword(db: Database, userId: ID, password: string): void {
  const value = parse(passwordSchema, password);
  const user = db.users.find((u) => u.id === userId);
  if (!user || !ownedWorkshops(db, userId).length) throw new DomainError("forbidden", "Só o dono da oficina cria senha.");
  user.passwordHash = demoHash(value);
}
