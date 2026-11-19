import { z } from "zod";
import type { Database, ID } from "@/domain/types";
import { DomainError, parse } from "./core";

/**
 * Conectar o aparelho à oficina (decisão 74).
 *
 * A conta da oficina e o e-mail do dono são cadastrados pela GAVYO (não há
 * "criar conta" aberto). No primeiro acesso o dono entra com esse e-mail,
 * confirma um código enviado por e-mail, cria a senha e o próprio PIN. Depois,
 * o aparelho fica conectado e cada funcionário entra só com o PIN.
 *
 * Demonstração: tudo roda no navegador e o código aparece na tela. Fase 2: o
 * servidor envia o código, guarda a senha com bcrypt e limita tentativas.
 */

export const emailSchema = z.string().trim().toLowerCase().email("E-mail inválido. Ex.: joao@suaoficina.com");
export const passwordSchema = z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(128, "Senha longa demais.");
const pinSchema = z.string().regex(/^\d{4}$/, "O PIN tem 4 números.");

export type EmailCheck =
  | { kind: "unknown" }
  | { kind: "not-owner"; name: string }
  | { kind: "first-access"; userId: ID; name: string }
  | { kind: "password"; userId: ID; name: string };

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
  return user.passwordHash ? { kind: "password", userId: user.id, name: user.name } : { kind: "first-access", userId: user.id, name: user.name };
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

/**
 * Cria ou troca a senha do dono. Só é chamada depois do código do e-mail
 * conferido (primeiro acesso ou "esqueci a senha").
 */
export function setOwnerPassword(db: Database, userId: ID, password: string): void {
  const value = parse(passwordSchema, password);
  const user = db.users.find((u) => u.id === userId);
  if (!user || !ownedWorkshops(db, userId).length) throw new DomainError("forbidden", "Só o dono da oficina cria senha.");
  user.passwordHash = demoHash(value);
}

/** No primeiro acesso, o dono cria o próprio PIN em cada oficina que é dele. */
export function setOwnerPin(db: Database, userId: ID, pin: string): void {
  const value = parse(pinSchema, pin);
  const mine = db.memberships.filter((m) => m.userId === userId && m.active && m.role === "owner");
  if (!mine.length) throw new DomainError("forbidden", "Só o dono da oficina faz o primeiro acesso.");
  mine.forEach((m) => { m.pin = value; });
}

/** "c•••••@oficina.com": mostra para onde o código foi sem expor o e-mail inteiro. */
export function maskedEmail(email: string): string {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 1)}${"•".repeat(Math.max(2, Math.min(name.length - 1, 6)))}@${domain}`;
}
