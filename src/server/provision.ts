import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { buildSeed, DEMO_WORKSHOP_ID } from "@/demo/seed";
import { ALL_MODULES, ROLE_TEMPLATES } from "@/domain/permissions";
import type { Database, ID } from "@/domain/types";
import { emailSchema, passwordSchema } from "@/services/auth";
import { DomainError, parse, scopeTo } from "@/services/core";
import { z } from "zod";
import { withConnection } from "./db";
import { emptyDatabase, insertWorkshop } from "./workshop-store";

/**
 * A GAVYO cria a oficina e o primeiro dono (decisão 74: não existe cadastro aberto).
 * O dono recebe o e-mail e a senha; o PIN é para entrar no aparelho depois de conectado.
 */
export const newWorkshopSchema = z.object({
  workshopName: z.string().trim().min(2, "Nome da oficina muito curto.").max(80),
  phone: z.string().trim().max(20).default(""),
  ownerName: z.string().trim().min(2, "Nome do dono muito curto.").max(80),
  ownerEmail: emailSchema,
  ownerPassword: passwordSchema,
  ownerPin: z.string().regex(/^\d{4}$/, "O PIN tem 4 números."),
});

export type NewWorkshopInput = z.input<typeof newWorkshopSchema>;

function slugify(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

async function emailTaken(email: string): Promise<boolean> {
  return withConnection(async (c) => {
    const [rows] = await c.query<RowDataPacket[]>("SELECT 1 FROM users WHERE email = ?", [email]);
    return rows.length > 0;
  });
}

/** Oficina vazia, pronta para usar. */
export async function createWorkshop(raw: NewWorkshopInput): Promise<{ workshopId: ID; ownerId: ID }> {
  const input = parse(newWorkshopSchema, raw);
  if (await emailTaken(input.ownerEmail)) throw new DomainError("conflict", "Esse e-mail já tem conta na GAVYO.");
  const workshopId = crypto.randomUUID();
  const ownerId = crypto.randomUUID();
  const db = emptyDatabase();
  db.workshops.push({ id: workshopId, name: input.workshopName, slug: slugify(input.workshopName), createdAt: new Date().toISOString() });
  db.settings.push({
    workshopId, displayName: input.workshopName, phone: input.phone, logoDataUrl: null,
    primaryColor: "#2563eb", secondaryColor: "#0f172a", activeModules: [...ALL_MODULES],
  });
  db.orderCounters[workshopId] = 1;
  db.users.push({ id: ownerId, name: input.ownerName, email: input.ownerEmail });
  db.memberships.push({
    id: crypto.randomUUID(), workshopId, userId: ownerId, role: "owner", active: true,
    permissions: [...ROLE_TEMPLATES.owner], pin: input.ownerPin,
  });
  await insertWorkshop(db, workshopId, { [ownerId]: input.ownerPassword });
  return { workshopId, ownerId };
}

/**
 * Oficina de demonstração com os dados de exemplo (Oficina Modelo Passaré),
 * para mostrar o sistema a clientes. Todos entram com o mesmo PIN.
 */
export async function createDemoWorkshop(ownerEmail: string, ownerPassword: string, pin: string): Promise<{ workshopId: ID }> {
  const email = parse(emailSchema, ownerEmail);
  parse(passwordSchema, ownerPassword);
  const seed = buildSeed();
  const view = scopeTo(seed, DEMO_WORKSHOP_ID);
  const db: Database = {
    ...emptyDatabase(),
    ...view,
    workshops: view.workshop ? [view.workshop] : [],
    settings: view.settings ? [view.settings] : [],
    orderCounters: { [DEMO_WORKSHOP_ID]: seed.orderCounters[DEMO_WORKSHOP_ID] },
  };
  delete (db as Partial<Record<"workshop", unknown>>).workshop;
  const owner = db.memberships.find((m) => m.role === "owner")!;
  db.users = db.users.map((u) => ({ ...u, passwordHash: undefined, email: u.id === owner.userId ? email : u.email }));
  for (const u of db.users) if (await emailTaken(u.email)) throw new DomainError("conflict", `O e-mail ${u.email} já tem conta na GAVYO.`);
  db.memberships.forEach((m) => { m.pin = pin; });
  await insertWorkshop(db, DEMO_WORKSHOP_ID, { [owner.userId]: ownerPassword });
  return { workshopId: DEMO_WORKSHOP_ID };
}
