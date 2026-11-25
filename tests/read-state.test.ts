/**
 * Leitura do estado da oficina (/api/estado) contra o banco da Hostinger:
 * lá `START TRANSACTION WITH CONSISTENT SNAPSHOT` é recusado ("Only REPEATABLE
 * READ isolation level is supported…"). Isso derrubou a entrada em 25/11:
 * o PIN passava, mas a oficina nunca carregava.
 */
import { describe, expect, it, vi } from "vitest";
import { buildSeed, DEMO_WORKSHOP_ID } from "@/demo/seed";

const seed = buildSeed();
const OWNER = seed.memberships.find((m) => m.workshopId === DEMO_WORKSHOP_ID && m.role === "owner")!.userId;
const sqls: string[] = [];

/** Conexão falsa que se comporta como o MySQL da Hostinger. */
const conn = {
  async query(sql: string) {
    sqls.push(sql);
    if (/CONSISTENT SNAPSHOT/i.test(sql)) {
      throw new Error("Only REPEATABLE READ isolation level is supported for START TRANSACTION WITH CONSISTENT SNAPSHOT in RocksDB Storage Engine.");
    }
    if (/FROM tenants/i.test(sql)) return [[{ version: 7, active: 1 }]];
    if (/FROM records/i.test(sql)) {
      const rows = (["workshops", "settings", "memberships"] as const).flatMap((kind) =>
        (seed[kind] as { workshopId?: string; id: string }[])
          .filter((x) => (kind === "workshops" ? x.id : x.workshopId) === DEMO_WORKSHOP_ID)
          .map((x) => ({ kind, data: JSON.stringify(x) })),
      );
      return [rows];
    }
    if (/FROM users/i.test(sql)) return [seed.users.map((u) => ({ data: JSON.stringify(u) }))];
    return [[]];
  },
};

vi.mock("@/server/db", () => ({
  withConnection: (fn: (c: typeof conn) => unknown) => fn(conn),
  transaction: (fn: (c: typeof conn) => unknown) => fn(conn),
}));

describe("readStateText no banco da Hostinger", () => {
  it("carrega a oficina sem usar transação com foto consistente", async () => {
    const { readStateText } = await import("@/server/workshop-store");
    const state = await readStateText(DEMO_WORKSHOP_ID, OWNER);
    expect(state?.version).toBe(7);
    expect(JSON.parse(state!.json).memberships.length).toBeGreaterThan(0);
    expect(sqls.some((s) => /CONSISTENT SNAPSHOT/i.test(s))).toBe(false);
  });
});
