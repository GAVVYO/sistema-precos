import { describe, expect, it } from "vitest";
import { buildSeed, DEMO_OWNER_ID, DEMO_WORKSHOP_ID } from "@/demo/seed";
import { recordCommands, replayCommands } from "@/services/commands";
import { type Ctx, DomainError } from "@/services/core";

const NOW = new Date("2026-11-16T15:00:00.000Z");
const ctx: Ctx = { userId: DEMO_OWNER_ID, workshopId: DEMO_WORKSHOP_ID, now: NOW };

describe("ações com nome (tela anota, servidor repete)", () => {
  it("o servidor chega no mesmo banco que a tela, com os mesmos IDs", () => {
    const screen = buildSeed(NOW);
    const server = structuredClone(screen);
    const part = screen.parts.find((p) => p.workshopId === DEMO_WORKSHOP_ID && p.quantity > 2)!;
    const { value, batch } = recordCommands(screen, ctx, (c) => {
      const customer = c.createCustomer({ name: "Maria Teste", phone: "(85) 98888-7777" });
      c.saveVehicle(customer.id, { plate: "QWE1R23", brand: "Fiat", model: "Uno", year: 2015, mileage: null });
      const order = c.createOrder({
        customer: { id: customer.id },
        vehicle: { plate: "QWE1R23", brand: "Fiat", model: "Uno", year: 2015, mileage: null },
        description: "Revisão",
        notes: "",
        mechanicId: null,
        laborCents: 5000,
        items: [{ partId: part.id, quantity: 1, unitPriceCents: part.priceCents }],
      });
      c.changeOrderStatus(order.id, "in_progress");
      return order;
    });
    expect(batch.calls.map((x) => x.name)).toEqual(["createCustomer", "saveVehicle", "createOrder", "changeOrderStatus"]);
    replayCommands(server, ctx, batch);
    expect(server).toEqual(screen);
    expect(server.orders.some((o) => o.id === value.id)).toBe(true);
  });

  it("não aceita nome fora da lista nem reaproveita um ID que já existe", () => {
    const db = buildSeed(NOW);
    expect(() => replayCommands(db, ctx, { calls: [{ name: "resetDemo" as never, args: [] }], ids: [] })).toThrow(DomainError);
    const existing = db.customers[0].id;
    replayCommands(db, ctx, { calls: [{ name: "createCustomer", args: [{ name: "Novo Cliente", phone: "(85) 97777-6666" }] }], ids: [existing] });
    const created = db.customers.find((c) => c.name === "Novo Cliente")!;
    expect(created.id).not.toBe(existing);
    expect(db.customers.filter((c) => c.id === existing)).toHaveLength(1);
  });

  it("as regras de permissão continuam valendo no servidor", () => {
    const db = buildSeed(NOW);
    const mechanic = db.memberships.find((m) => m.workshopId === DEMO_WORKSHOP_ID && m.role === "mechanic")!;
    expect(() =>
      replayCommands(db, { ...ctx, userId: mechanic.userId }, { calls: [{ name: "createExpense", args: [{ description: "x", category: "Outros", amountCents: 100, date: "2026-11-16", method: "pix", notes: "" }] }], ids: [] }),
    ).toThrow(DomainError);
  });
});
