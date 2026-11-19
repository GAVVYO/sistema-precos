import { z } from "zod";
import { ALL_MODULES, ALL_PERMISSIONS, MODULES, ROLE_TEMPLATES } from "@/domain/permissions";
import type { Database, ID, ModuleKey, PermissionKey, Role, WorkshopMembership } from "@/domain/types";
import { normalizePhone } from "@/lib/format";
import { assertCan, Ctx, DomainError, findScoped, membershipOf, newId, parse } from "./core";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida.");

const settingsSchema = z.object({
  displayName: z.string().trim().min(2, "Informe o nome da oficina."),
  phone: z.string().refine((v) => v.trim() === "" || normalizePhone(v) !== null, "Telefone inválido."),
  logoDataUrl: z
    .string()
    .startsWith("data:image/", "Logotipo inválido.")
    .max(400_000, "Imagem muito grande. Use um logotipo de até 250 KB.")
    .nullable(),
  primaryColor: hex,
  secondaryColor: hex,
  activeModules: z.array(z.enum(ALL_MODULES as [ModuleKey, ...ModuleKey[]])),
});

export type SettingsInput = z.input<typeof settingsSchema>;

export function updateSettings(db: Database, ctx: Ctx, input: SettingsInput): void {
  assertCan(db, ctx, "settings.manage");
  const data = parse(settingsSchema, input);
  const settings = db.settings.find((s) => s.workshopId === ctx.workshopId);
  if (!settings) throw new DomainError("not_found", "Configurações da oficina não encontradas.");
  const required = MODULES.filter((m) => m.required).map((m) => m.key);
  Object.assign(settings, data, {
    phone: normalizePhone(data.phone) ?? "",
    activeModules: ALL_MODULES.filter((m) => required.includes(m) || data.activeModules.includes(m)),
  });
}

const memberSchema = z.object({
  role: z.enum(["owner", "receptionist", "mechanic", "financial"]),
  active: z.boolean(),
  permissions: z.array(z.enum(ALL_PERMISSIONS as [PermissionKey, ...PermissionKey[]])),
});

export interface MemberInput {
  role: Role;
  active: boolean;
  permissions: PermissionKey[];
}

/**
 * Regras contra elevação indevida de privilégios:
 * - ninguém altera o próprio acesso;
 * - só é possível conceder permissões que o próprio operador possui;
 * - somente proprietários alteram ou criam outros proprietários;
 * - a oficina nunca fica sem um proprietário ativo.
 */
function assertCanGrant(db: Database, ctx: Ctx, target: WorkshopMembership | null, next: MemberInput) {
  const actor = membershipOf(db, ctx);
  if (!actor) throw new DomainError("forbidden", "Você não tem acesso a esta oficina.");
  if (target && target.userId === ctx.userId) {
    throw new DomainError("forbidden", "Você não pode alterar o seu próprio acesso.");
  }
  if ((target?.role === "owner" || next.role === "owner") && actor.role !== "owner") {
    throw new DomainError("forbidden", "Somente um proprietário pode alterar o acesso de proprietários.");
  }
  const previous = new Set(target?.permissions ?? []);
  const notAllowed = next.permissions.filter(
    (p) => !previous.has(p) && !actor.permissions.includes(p),
  );
  if (notAllowed.length) {
    throw new DomainError("forbidden", "Você não pode conceder permissões que você mesmo não possui.");
  }
  if (target?.role === "owner" && (next.role !== "owner" || !next.active)) {
    const otherOwners = db.memberships.some(
      (m) => m.workshopId === ctx.workshopId && m.role === "owner" && m.active && m.id !== target.id,
    );
    if (!otherOwners) throw new DomainError("conflict", "A oficina precisa de ao menos um proprietário ativo.");
  }
}

export function updateMember(db: Database, ctx: Ctx, membershipId: ID, input: MemberInput): void {
  assertCan(db, ctx, "staff.manage");
  const data = parse(memberSchema, input);
  const target = findScoped(db.memberships, ctx, membershipId, "Funcionário não encontrado.");
  assertCanGrant(db, ctx, target, data);
  target.role = data.role;
  target.active = data.active;
  target.permissions = ALL_PERMISSIONS.filter((p) => data.permissions.includes(p));
}

/** Foto do crachá: imagem pequena embutida (data URL), até ~300 KB. */
const photoSchema = z
  .string()
  .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, "Foto inválida.")
  .max(400_000, "Foto grande demais. Escolha outra.")
  .nullable()
  .optional();
const memberPhoneSchema = z
  .string()
  .optional()
  .refine((v) => !v || v.trim() === "" || normalizePhone(v) !== null, "Telefone inválido. Use DDD + número.");

const newMemberSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do funcionário."),
  email: z.string().trim().toLowerCase().email("E-mail inválido. Ex.: joao@oficina.com"),
  role: z.enum(["owner", "receptionist", "mechanic", "financial"]),
  phone: memberPhoneSchema,
  photo: photoSchema,
});

const profileSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do funcionário."),
  phone: memberPhoneSchema,
  photo: photoSchema,
});

/** Nome, telefone e foto do funcionário (o crachá). Acesso continua em updateMember. */
export function updateMemberProfile(db: Database, ctx: Ctx, membershipId: ID, input: z.input<typeof profileSchema>): void {
  assertCan(db, ctx, "staff.manage");
  const data = parse(profileSchema, input);
  const target = findScoped(db.memberships, ctx, membershipId, "Funcionário não encontrado.");
  const user = db.users.find((u) => u.id === target.userId);
  if (!user) throw new DomainError("not_found", "Funcionário não encontrado.");
  user.name = data.name;
  user.phone = data.phone ? normalizePhone(data.phone) ?? "" : "";
  if (data.photo !== undefined) user.photo = data.photo;
}

export function addMember(db: Database, ctx: Ctx, input: z.input<typeof newMemberSchema>): WorkshopMembership {
  assertCan(db, ctx, "staff.manage");
  const data = parse(newMemberSchema, input);
  const actor = membershipOf(db, ctx)!;
  const permissions = ROLE_TEMPLATES[data.role].filter(
    (p) => actor.role === "owner" || actor.permissions.includes(p),
  );
  assertCanGrant(db, ctx, null, { role: data.role, active: true, permissions });
  let user = db.users.find((u) => u.email === data.email);
  if (user && db.memberships.some((m) => m.workshopId === ctx.workshopId && m.userId === user!.id)) {
    throw new DomainError("conflict", "Já existe um funcionário com este e-mail nesta oficina.");
  }
  if (!user) {
    user = { id: newId(), name: data.name, email: data.email };
    db.users.push(user);
  }
  if (data.phone) user.phone = normalizePhone(data.phone) ?? "";
  if (data.photo) user.photo = data.photo;
  const membership: WorkshopMembership = {
    id: newId(),
    workshopId: ctx.workshopId,
    userId: user.id,
    role: data.role,
    active: true,
    permissions,
  };
  db.memberships.push(membership);
  return membership;
}

/* ---------- PIN de entrada (decisão 70) ---------- */

export const DEMO_PIN = "1234";
const pinSchema = z.string().regex(/^\d{4}$/, "O PIN tem 4 números.");

/** Confere o PIN de quem está entrando. Não exige sessão (é a própria entrada). */
export function verifyPin(db: Database, workshopId: ID, userId: ID, pin: string): boolean {
  const m = db.memberships.find((x) => x.workshopId === workshopId && x.userId === userId && x.active);
  if (!m) return false;
  return (m.pin ?? DEMO_PIN) === pin;
}

/** O dono (ou quem gerencia funcionários) troca o PIN de alguém. */
export function setMemberPin(db: Database, ctx: Ctx, membershipId: ID, pin: string): void {
  assertCan(db, ctx, "staff.manage");
  const value = parse(pinSchema, pin);
  const target = findScoped(db.memberships, ctx, membershipId, "Funcionário não encontrado.");
  // Trocar o PIN do dono é entrar como ele: só outro dono (ou ele mesmo) pode.
  if (target.role === "owner" && target.userId !== ctx.userId && membershipOf(db, ctx)?.role !== "owner") {
    throw new DomainError("forbidden", "Somente um proprietário pode trocar o PIN de proprietários.");
  }
  target.pin = value;
}
