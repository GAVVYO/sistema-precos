import type { Database, ID, Role } from "@/domain/types";
import { assertCan, type Ctx, DomainError, findScoped, membershipOf, newId } from "./core";

/**
 * QR para conectar um celular (decisão 76).
 *
 * - **Pessoal:** o dono gera em Pessoas; a pessoa aponta a câmera do app e já
 *   entra como ela. Depois, o app abre com a digital ou o PIN.
 * - **Aparelho da oficina:** celular ou tablet do balcão, de várias pessoas;
 *   abre em "Quem está entrando?" com PIN.
 *
 * Vale 10 minutos. Demonstração: o QR leva a oficina e a pessoa (o app tem os
 * mesmos dados de exemplo). Fase 2: o QR leva um código de uso único criado
 * pelo servidor; o celular troca por uma chave guardada no cofre do aparelho
 * e o dono pode desconectar aparelhos em Pessoas.
 */

export const PAIRING_TTL = 10 * 60_000;
const PREFIX = "gavyoauto://conectar?c=";

export type PairingInput = { kind: "person"; membershipId: ID } | { kind: "device" };
/** Demonstração: dados da pessoa, para o app reconhecer quem foi cadastrado no site (fase 2: vem do servidor). */
export interface PairingProfile { name: string; email: string; role: Role }
export type Pairing =
  | { kind: "person"; workshopId: ID; userId: ID; profile?: PairingProfile }
  | { kind: "device"; workshopId: ID };
interface Payload { v: 1; k: "person" | "device"; w: ID; u?: ID; p?: PairingProfile; exp: number; n: string }

/** Gera o conteúdo do QR. Só quem gerencia funcionários (e só dono gera QR de dono). */
export function createPairing(db: Database, ctx: Ctx, input: PairingInput): { code: string; expiresAt: number } {
  assertCan(db, ctx, "staff.manage");
  const exp = ctx.now.getTime() + PAIRING_TTL;
  const payload: Payload = { v: 1, k: input.kind, w: ctx.workshopId, exp, n: newId() };
  if (input.kind === "person") {
    const target = findScoped(db.memberships, ctx, input.membershipId, "Funcionário não encontrado.");
    if (!target.active) throw new DomainError("conflict", "Essa pessoa está sem acesso. Dê acesso antes de conectar o celular.");
    // Entrar como o dono é coisa de dono (mesma regra da troca de PIN).
    if (target.role === "owner" && target.userId !== ctx.userId && membershipOf(db, ctx)?.role !== "owner") {
      throw new DomainError("forbidden", "Somente um proprietário conecta o celular de proprietários.");
    }
    payload.u = target.userId;
    const u = db.users.find((x) => x.id === target.userId);
    if (u) payload.p = { name: u.name, email: u.email, role: target.role };
  }
  return { code: PREFIX + encodeURIComponent(JSON.stringify(payload)), expiresAt: exp };
}

/** Lê o QR no app. Erros em frases simples, para mostrar na tela da câmera. */
export function readPairing(db: Database, raw: string, now: Date): Pairing {
  if (!raw.startsWith(PREFIX)) throw new DomainError("validation", "Esse QR não é da GAVYO. Use o QR que aparece em Pessoas, no computador.");
  let p: Payload;
  try { p = JSON.parse(decodeURIComponent(raw.slice(PREFIX.length))) as Payload; } catch { throw new DomainError("validation", "Não deu para ler o QR. Tente de novo."); }
  if (p.v !== 1 || (p.k !== "person" && p.k !== "device") || typeof p.exp !== "number") throw new DomainError("validation", "Não deu para ler o QR. Tente de novo.");
  if (p.exp < now.getTime()) throw new DomainError("validation", "Esse QR venceu. Peça para gerar outro em Pessoas.");
  if (!db.workshops.some((w) => w.id === p.w)) throw new DomainError("not_found", "Oficina não encontrada.");
  if (p.k === "device") return { kind: "device", workshopId: p.w };
  if (!p.u) throw new DomainError("validation", "Não deu para ler o QR. Tente de novo.");
  const m = db.memberships.find((x) => x.workshopId === p.w && x.userId === p.u);
  if (m && !m.active) throw new DomainError("forbidden", "Essa pessoa está sem acesso. Fale com o dono.");
  // Cadastrada no site depois que o app baixou os dados: na demonstração, o QR traz quem é.
  if (!m && !p.p) throw new DomainError("not_found", "Pessoa não encontrada. Peça para gerar outro QR.");
  return { kind: "person", workshopId: p.w, userId: p.u, ...(m ? {} : { profile: p.p }) };
}
