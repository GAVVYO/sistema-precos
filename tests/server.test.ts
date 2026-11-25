/**
 * Servidor contra um MySQL de verdade (decisão 96). Roda quando TEST_DATABASE_URL
 * existe (ex.: mysql://gavyo:senha@127.0.0.1:3306/gavyo_test); sem ela, é pulado.
 * ATENÇÃO: apaga as tabelas do banco de teste.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mysql from "mysql2/promise";
import { adminLogin, isAdmin, listWorkshops, resetOwnerPassword, setWorkshopActive } from "@/server/admin";
import { connectDevice, deviceOf, ownerSession, peopleOf, pinLogin, sessionOf } from "@/server/auth";
import { closePool } from "@/server/db";
import { createDemoWorkshop, createWorkshop } from "@/server/provision";
import { readImage } from "@/server/files";
import { applyBatch, clearCache, readState } from "@/server/workshop-store";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DomainError } from "@/services/core";

const URL = process.env.TEST_DATABASE_URL;

async function expectCode(p: Promise<unknown>, code: DomainError["code"]) {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    expect((e as DomainError).code).toBe(code);
    return;
  }
  throw new Error(`Esperava erro ${code}.`);
}

describe.skipIf(!URL)("servidor com MySQL", () => {
  let A: { workshopId: string; ownerId: string };
  let B: { workshopId: string; ownerId: string };
  let sessionA: { workshopId: string; userId: string };

  beforeAll(async () => {
    const c = await mysql.createConnection(URL!);
    for (const t of ["tenants", "records", "users", "devices", "sessions", "attempts"]) await c.query(`DROP TABLE IF EXISTS ${t}`);
    await c.end();
    process.env.DATABASE_URL = URL;
    process.env.UPLOAD_DIR = mkdtempSync(path.join(tmpdir(), "gavyo-arquivos-"));
    A = await createWorkshop({ workshopName: "Oficina A", ownerName: "Ana Dona", ownerEmail: "ana@a.com", ownerPassword: "senha-forte-a", ownerPin: "1111" });
    B = await createWorkshop({ workshopName: "Oficina B", ownerName: "Beto Dono", ownerEmail: "beto@b.com", ownerPassword: "senha-forte-b", ownerPin: "2222" });
  });
  afterAll(async () => {
    await closePool();
  });

  it("não cria dois donos com o mesmo e-mail", async () => {
    await expectCode(createWorkshop({ workshopName: "Outra", ownerName: "Ana", ownerEmail: "ANA@a.com", ownerPassword: "12345678", ownerPin: "1234" }), "conflict");
  });

  it("conecta o aparelho só com a senha certa e bloqueia depois de 5 erros", async () => {
    await expectCode(connectDevice("beto@b.com", "errada"), "forbidden");
    const ok = await connectDevice("beto@b.com", "senha-forte-b");
    expect(ok.workshopId).toBe(B.workshopId);
    for (let i = 0; i < 5; i++) await expectCode(connectDevice("beto@b.com", "errada"), "forbidden");
    await expect(connectDevice("beto@b.com", "senha-forte-b")).rejects.toThrow(/Espere/);
  });

  it("entra com o PIN e a sessão só vale no aparelho dela", async () => {
    const dev = await connectDevice("ana@a.com", "senha-forte-a");
    const device = (await deviceOf(dev.token))!;
    const { people, workshopName } = await peopleOf(device);
    expect(workshopName).toBe("Oficina A");
    expect(people).toEqual([expect.objectContaining({ userId: A.ownerId, name: "Ana Dona", role: "owner" })]);
    expect(JSON.stringify(people)).not.toMatch(/scrypt|1111/);
    await expectCode(pinLogin(device, A.ownerId, "9999"), "forbidden");
    const s = await pinLogin(device, A.ownerId, "1111");
    sessionA = (await sessionOf(dev.token, s.token))!;
    expect(sessionA).toEqual({ workshopId: A.workshopId, userId: A.ownerId });
    const other = await connectDevice("ana@a.com", "senha-forte-a");
    expect(await sessionOf(other.token, s.token)).toBeNull();
  });

  it("grava as ações, sobe a versão e não devolve PIN nem senha", async () => {
    const before = (await readState(A.workshopId, A.ownerId))!;
    const id = crypto.randomUUID();
    const r = await applyBatch(A.workshopId, A.ownerId, { calls: [{ name: "createCustomer", args: [{ name: "Cliente Um", phone: "(85) 98888-1111" }] }], ids: [id] });
    expect(r.from).toBe(before.version);
    expect(r.version).toBe(before.version + 1);
    expect(r.changes.upserts.customers?.[0]).toMatchObject({ id, name: "Cliente Um" });
    expect(await readState(A.workshopId, A.ownerId, r.version)).toBeNull();
    clearCache();
    const after = (await readState(A.workshopId, A.ownerId))!;
    expect(after.db.customers.map((c) => c.id)).toContain(id);
    expect(JSON.stringify(after.db)).not.toMatch(/scrypt|passwordHash|"pin"/);
  });

  it("PIN novo de funcionário vai para o banco só como resumo", async () => {
    const r = await applyBatch(A.workshopId, A.ownerId, {
      calls: [{ name: "addMember", args: [{ name: "Raul Mecânico", email: "raul@a.com", role: "mechanic", phone: "" }] }],
      ids: [],
    });
    const m = r.changes.upserts.memberships![0] as { id: string };
    await applyBatch(A.workshopId, A.ownerId, { calls: [{ name: "setMemberPin", args: [m.id, "4321"] }], ids: [] });
    const c = await mysql.createConnection(URL!);
    const [rows] = await c.query<mysql.RowDataPacket[]>("SELECT data FROM records WHERE kind = 'memberships' AND id = ?", [m.id]);
    await c.end();
    expect(JSON.parse(rows[0].data).pin).toMatch(/^scrypt\$/);
    const dev = await connectDevice("ana@a.com", "senha-forte-a");
    const device = (await deviceOf(dev.token))!;
    const mech = (await peopleOf(device)).people.find((p) => p.name === "Raul Mecânico")!;
    await expect(pinLogin(device, mech.userId, "4321")).resolves.toBeTruthy();
  });

  it("uma oficina não lê nem mexe nos dados da outra", async () => {
    const stateA = (await readState(A.workshopId, A.ownerId))!;
    const customer = stateA.db.customers[0];
    await expectCode(readState(A.workshopId, B.ownerId), "forbidden");
    await expectCode(
      applyBatch(B.workshopId, B.ownerId, { calls: [{ name: "updateCustomer", args: [customer.id, { name: "Invadido", phone: "(85) 90000-0000" }] }], ids: [] }),
      "not_found",
    );
    await expectCode(applyBatch(A.workshopId, B.ownerId, { calls: [{ name: "createCustomer", args: [{ name: "Intruso", phone: "(85) 90000-0001" }] }], ids: [] }), "forbidden");
  });

  it("duas baixas ao mesmo tempo da última peça: só uma passa", async () => {
    const created = await applyBatch(A.workshopId, A.ownerId, {
      calls: [{ name: "createPart", args: [{ code: "FIL-1", name: "Filtro", category: "Filtros", unit: "un", costCents: 1000, priceCents: 2000, minQuantity: 0, initialQuantity: 1 }] }],
      ids: [],
    });
    const partId = created.changes.upserts.parts![0].id;
    const out = () => applyBatch(A.workshopId, A.ownerId, { calls: [{ name: "moveStock", args: [{ partId, type: "out", quantity: 1, reason: "Venda" }] }], ids: [] });
    const results = await Promise.allSettled([out(), out()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    clearCache();
    const part = (await readState(A.workshopId, A.ownerId))!.db.parts.find((p) => p.id === partId)!;
    expect(part.quantity).toBe(0);
  });

  it("cria a oficina de demonstração com os dados de exemplo", async () => {
    const { workshopId } = await createDemoWorkshop("demo@gavyo.me", "senha-da-demo", "1234");
    const dev = await connectDevice("demo@gavyo.me", "senha-da-demo");
    expect(dev.workshopId).toBe(workshopId);
    const owner = (await peopleOf((await deviceOf(dev.token))!)).people.find((p) => p.role === "owner")!;
    const state = (await readState(workshopId, owner.userId))!;
    expect(state.db.orders.length).toBeGreaterThan(5);
    expect(state.db.users.every((u) => !("passwordHash" in u) || u.passwordHash === undefined)).toBe(true);
  });

  it("criar a demonstração de novo dá aviso claro, não erro 500", async () => {
    await expectCode(createDemoWorkshop("outro@x.com", "senha-boa-123", "1234"), "conflict");
  });

  it("área da GAVYO: chave, lista, troca de senha e desativar", async () => {
    process.env.GAVYO_ADMIN_KEY = "chave-de-teste-com-mais-de-24-letras";
    await expectCode(adminLogin("errada"), "forbidden");
    const { cookie } = await adminLogin("chave-de-teste-com-mais-de-24-letras");
    expect(isAdmin(cookie, null)).toBe(true);
    expect(isAdmin(cookie.replace(/.$/, "x"), null)).toBe(false);
    const list = await listWorkshops();
    expect(list.find((w) => w.id === B.workshopId)?.owner?.email).toBe("beto@b.com");
    await resetOwnerPassword(B.workshopId, "senha-nova-beto");
    await expectCode(connectDevice("beto@b.com", "senha-forte-b"), "forbidden");
    const dev = await connectDevice("beto@b.com", "senha-nova-beto");
    const s = await pinLogin((await deviceOf(dev.token))!, B.ownerId, "2222");
    await setWorkshopActive(B.workshopId, false);
    expect(await sessionOf(dev.token, s.token)).toBeNull();
    await expectCode(connectDevice("beto@b.com", "senha-nova-beto"), "forbidden");
    await setWorkshopActive(B.workshopId, true);
    await expect(connectDevice("beto@b.com", "senha-nova-beto")).resolves.toBeTruthy();
  });

  it("trocar a senha do dono desconecta os aparelhos e encerra as sessões", async () => {
    const dev = await connectDevice("ana@a.com", "senha-forte-a");
    const ses = await ownerSession(dev.token, dev.workshopId, dev.userId);
    expect(await sessionOf(dev.token, ses.token)).not.toBeNull();
    await resetOwnerPassword(A.workshopId, "outra-senha-boa-123");
    expect(await deviceOf(dev.token)).toBeNull();
    expect(await sessionOf(dev.token, ses.token)).toBeNull();
    await expectCode(connectDevice("ana@a.com", "senha-forte-a"), "forbidden");
    expect((await connectDevice("ana@a.com", "outra-senha-boa-123")).workshopId).toBe(A.workshopId);
    // Volta a senha para os testes seguintes.
    await resetOwnerPassword(A.workshopId, "senha-forte-a");
  });

  it("foto vira arquivo: o banco guarda só o endereço, e apagar a foto apaga o arquivo", async () => {
    // JPEG mínimo válido (1x1).
    const jpeg = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
    const created = await applyBatch(A.workshopId, A.ownerId, {
      calls: [{ name: "createPart", args: [{ code: "FOTO-1", name: "Peça com foto", category: "Filtros", unit: "un", costCents: 100, priceCents: 200, minQuantity: 0, initialQuantity: 1, photo: jpeg }] }],
      ids: [],
    });
    const part = created.changes.upserts.parts![0] as { id: string; photo: string };
    expect(part.photo).toMatch(new RegExp(`^/api/arquivos/${A.workshopId}/[\\w-]+\\.jpg$`));
    const name = part.photo.split("/").pop()!;
    const file = path.join(process.env.UPLOAD_DIR!, A.workshopId, name);
    expect(existsSync(file)).toBe(true);
    expect((await readImage(A.workshopId, name))?.type).toBe("image/jpeg");
    expect(await readImage(B.workshopId, name)).toBeNull();
    // Editar a peça mantendo a foto (o endereço volta como veio) não cria arquivo novo.
    await applyBatch(A.workshopId, A.ownerId, { calls: [{ name: "setPartPhoto", args: [part.id, part.photo] }], ids: [] });
    expect(existsSync(file)).toBe(true);
    await applyBatch(A.workshopId, A.ownerId, { calls: [{ name: "setPartPhoto", args: [part.id, null] }], ids: [] });
    expect(existsSync(file)).toBe(false);
    // Texto disfarçado de JPEG é recusado.
    const fake = `data:image/jpeg;base64,${Buffer.from("<script>alert(1)</script>").toString("base64")}`;
    await expectCode(applyBatch(A.workshopId, A.ownerId, { calls: [{ name: "setPartPhoto", args: [part.id, fake] }], ids: [] }), "validation");
  });
});
