import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed, DEMO_OWNER_ID, DEMO_WORKSHOP_ID, SECOND_WORKSHOP_ID } from "@/demo/seed";
import type { Database } from "@/domain/types";
import { todayISO } from "@/lib/format";
import { addMember, DEMO_PIN, setMemberPin, updateMember, updateMemberProfile, updateSettings, verifyPin } from "@/services/admin";
import { createAppointment } from "@/services/appointments";
import { Ctx, DomainError, scopeTo } from "@/services/core";
import { createExpense, financeSummary, listReceivables } from "@/services/finance";
import {
  cancelOrder,
  changeOrderStatus,
  createOrder,
  orderTotals,
  paymentSituation,
  registerPayment,
  setOrderItems,
  updateOrder,
} from "@/services/orders";
import { moveStock } from "@/services/stock";

const NOW = new Date("2026-11-16T15:00:00.000Z");
let db: Database;
const ctx = (userId = DEMO_OWNER_ID, workshopId = DEMO_WORKSHOP_ID): Ctx => ({ userId, workshopId, now: NOW });
const part = (code: string, ws = DEMO_WORKSHOP_ID) => db.parts.find((p) => p.workshopId === ws && p.code === code)!;

function newOrder(items: { code: string; quantity: number }[] = [], laborCents: number | null = 10000) {
  return createOrder(db, ctx(), {
    customer: { name: "Cliente Teste", phone: "(85) 98765-4321" },
    vehicle: { plate: "abc1d23", brand: "Fiat", model: "Argo", year: 2020, mileage: 30000 },
    description: "Troca de óleo",
    notes: "",
    mechanicId: "u-raimundo",
    laborCents,
    items: items.map((i) => ({ partId: part(i.code).id, quantity: i.quantity, unitPriceCents: part(i.code).priceCents })),
  });
}

function expectError(fn: () => unknown, code: DomainError["code"]) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    expect((e as DomainError).code).toBe(code);
    return;
  }
  throw new Error(`Esperava erro ${code}, mas a operação foi concluída.`);
}

beforeEach(() => {
  db = buildSeed(NOW);
});

describe("seed de demonstração", () => {
  it("toda OS paga tem exatamente uma receita correspondente", () => {
    for (const order of db.orders.filter((o) => o.paymentId)) {
      const incomes = db.transactions.filter((t) => t.orderId === order.id && t.kind === "income");
      expect(incomes).toHaveLength(1);
      expect(incomes[0].amountCents).toBe(orderTotals(db, order).totalCents);
      expect(incomes[0].workshopId).toBe(order.workshopId);
    }
  });

  it("o saldo de cada peça é a soma das suas movimentações", () => {
    for (const p of db.parts) {
      const sum = db.stockMovements.filter((m) => m.partId === p.id).reduce((s, m) => s + m.delta, 0);
      expect(sum).toBe(p.quantity);
      expect(p.quantity).toBeGreaterThanOrEqual(0);
    }
  });

  it("peças usadas em OS ativas têm baixa de estoque equivalente", () => {
    for (const item of db.orderItems) {
      const order = db.orders.find((o) => o.id === item.orderId)!;
      const net = db.stockMovements
        .filter((m) => m.orderId === order.id && m.partId === item.partId)
        .reduce((s, m) => s + m.delta, 0);
      expect(net).toBe(order.cancelledAt ? 0 : -item.quantity);
    }
  });
});

describe("estoque integrado às OS", () => {
  it("baixa automática ao salvar a OS (20 filtros − 2 = 18)", () => {
    moveStock(db, ctx(), { partId: part("FIL-002").id, type: "adjust", quantity: 20, reason: "Contagem" });
    newOrder([{ code: "FIL-002", quantity: 2 }]);
    expect(part("FIL-002").quantity).toBe(18);
  });

  it("alterar quantidade movimenta apenas a diferença; remover devolve", () => {
    const before = part("FIL-001").quantity;
    const order = newOrder([{ code: "FIL-001", quantity: 2 }]);
    const item = { partId: part("FIL-001").id, unitPriceCents: 3500 };
    setOrderItems(db, ctx(), order.id, [{ ...item, quantity: 5 }]);
    expect(part("FIL-001").quantity).toBe(before - 5);
    setOrderItems(db, ctx(), order.id, [{ ...item, quantity: 1 }]);
    expect(part("FIL-001").quantity).toBe(before - 1);
    setOrderItems(db, ctx(), order.id, []);
    expect(part("FIL-001").quantity).toBe(before);
    const moves = db.stockMovements.filter((m) => m.orderId === order.id).map((m) => m.delta);
    expect(moves).toEqual([-2, -3, 4, 1]);
  });

  it("não permite estoque negativo", () => {
    const available = part("ELE-001").quantity;
    expectError(() => newOrder([{ code: "ELE-001", quantity: available + 1 }]), "conflict");
    expectError(
      () => moveStock(db, ctx(), { partId: part("ELE-001").id, type: "out", quantity: available + 1, reason: "Perda" }),
      "conflict",
    );
  });

  it("concluir a OS não realiza segunda baixa", () => {
    const order = newOrder([{ code: "OLE-001", quantity: 4 }]);
    const afterCreate = part("OLE-001").quantity;
    changeOrderStatus(db, ctx(), order.id, "in_progress");
    changeOrderStatus(db, ctx(), order.id, "done");
    expect(part("OLE-001").quantity).toBe(afterCreate);
  });

  it("OS concluída exige motivo explícito para corrigir peças", () => {
    const order = newOrder([{ code: "OLE-001", quantity: 4 }]);
    changeOrderStatus(db, ctx(), order.id, "done");
    expectError(() => setOrderItems(db, ctx(), order.id, []), "validation");
    const before = part("OLE-001").quantity;
    setOrderItems(db, ctx(), order.id, [], "Lançamento em duplicidade");
    expect(part("OLE-001").quantity).toBe(before + 4);
  });

  it("cancelar devolve as peças somente quando solicitado", () => {
    const before = part("FRE-001").quantity;
    const a = newOrder([{ code: "FRE-001", quantity: 1 }]);
    cancelOrder(db, ctx(), a.id, { reason: "Cliente desistiu", returnParts: true });
    expect(part("FRE-001").quantity).toBe(before);
    const b = newOrder([{ code: "FRE-001", quantity: 1 }]);
    cancelOrder(db, ctx(), b.id, { reason: "Peça danificada na instalação", returnParts: false });
    expect(part("FRE-001").quantity).toBe(before - 1);
    expectError(() => cancelOrder(db, ctx(), b.id, { reason: "De novo", returnParts: true }), "conflict");
  });
});

describe("financeiro", () => {
  it("OS concluída não é receita até o pagamento; pagamento não duplica", () => {
    const today = todayISO(NOW);
    const before = financeSummary(scopeTo(db, DEMO_WORKSHOP_ID), today, today);
    const order = newOrder([{ code: "FIL-001", quantity: 1 }], 10000);
    changeOrderStatus(db, ctx(), order.id, "done");
    let view = scopeTo(db, DEMO_WORKSHOP_ID);
    let now = financeSummary(view, today, today);
    expect(now.receivedCents).toBe(before.receivedCents);
    expect(now.receivableCents).toBe(before.receivableCents + 13500);
    expect(now.billedCents).toBe(before.billedCents + 13500);
    expect(listReceivables(view).some((r) => r.order?.id === order.id)).toBe(true);

    registerPayment(db, ctx("u-ana"), order.id, { method: "pix" });
    view = scopeTo(db, DEMO_WORKSHOP_ID);
    now = financeSummary(view, today, today);
    expect(now.receivedCents).toBe(before.receivedCents + 13500);
    expect(now.receivableCents).toBe(before.receivableCents);
    expectError(() => registerPayment(db, ctx("u-ana"), order.id, { method: "cash" }), "conflict");
    expect(db.transactions.filter((t) => t.orderId === order.id)).toHaveLength(1);
  });

  it("diferencia valor a definir de serviço gratuito", () => {
    const pending = newOrder([], null);
    expect(paymentSituation(pending, orderTotals(db, pending))).toBe("undefined");
    expectError(() => registerPayment(db, ctx(), pending.id, { method: "pix" }), "validation");
    updateOrder(db, ctx(), pending.id, { description: "Cortesia", notes: "", mechanicId: null, laborCents: 0 });
    const free = db.orders.find((o) => o.id === pending.id)!;
    expect(paymentSituation(free, orderTotals(db, free))).toBe("free");
  });

  it("resultado de caixa = recebido − despesas pagas", () => {
    const today = todayISO(NOW);
    const before = financeSummary(scopeTo(db, DEMO_WORKSHOP_ID), today, today);
    createExpense(db, ctx("u-ana"), { description: "Estopa e desengraxante", category: "Outras despesas", amountCents: 4200, date: today, method: "cash" });
    const after = financeSummary(scopeTo(db, DEMO_WORKSHOP_ID), today, today);
    expect(after.cashResultCents).toBe(before.cashResultCents - 4200);
  });
});

describe("agenda", () => {
  it("converte agendamento em OS uma única vez", () => {
    const a = createAppointment(db, ctx("u-juliana"), {
      customerName: "Novo Cliente", phone: "85999990000", plate: "", brand: "Fiat", model: "Mobi",
      service: "Revisão", date: "2026-11-20", time: "09:00", mechanicId: null, notes: "",
    });
    const input = {
      customer: { name: a.customerName, phone: a.phone },
      vehicle: { plate: "XYZ1A23", brand: "Fiat", model: "Mobi", year: null, mileage: null },
      description: a.service, notes: "", mechanicId: null, laborCents: null, items: [], appointmentId: a.id,
    };
    const order = createOrder(db, ctx("u-juliana"), input);
    const saved = db.appointments.find((x) => x.id === a.id)!;
    expect(saved.orderId).toBe(order.id);
    expect(saved.status).toBe("attended");
    expectError(() => createOrder(db, ctx("u-juliana"), input), "conflict");
  });
});

describe("permissões", () => {
  it("cada cargo só executa o que seu modelo permite", () => {
    const order = newOrder();
    expectError(() => createExpense(db, ctx("u-raimundo"), { description: "Teste", category: "Aluguel", amountCents: 100, date: "2026-11-16", method: "pix" }), "forbidden");
    // Recepção recebe no balcão (decisão 46), mas não lança despesa; mecânico não recebe.
    expectError(() => registerPayment(db, ctx("u-raimundo"), order.id, { method: "pix" }), "forbidden");
    expectError(() => createExpense(db, ctx("u-juliana"), { description: "Teste", category: "Aluguel", amountCents: 100, date: "2026-11-16", method: "pix" }), "forbidden");
    expectError(() => changeOrderStatus(db, ctx("u-juliana"), order.id, "done"), "forbidden");
    expectError(() => cancelOrder(db, ctx("u-raimundo"), order.id, { reason: "teste", returnParts: true }), "forbidden");
    changeOrderStatus(db, ctx("u-raimundo"), order.id, "done");
    expect(db.orders.find((o) => o.id === order.id)!.status).toBe("done");
  });

  it("impede elevação indevida de privilégios", () => {
    const juliana = db.memberships.find((m) => m.userId === "u-juliana")!;
    const carlos = db.memberships.find((m) => m.userId === DEMO_OWNER_ID)!;
    // Proprietário concede "gerenciar funcionários" à recepcionista.
    updateMember(db, ctx(), juliana.id, { role: "receptionist", active: true, permissions: [...juliana.permissions, "staff.manage"] });
    const raimundo = db.memberships.find((m) => m.userId === "u-raimundo")!;
    // Ela não pode alterar a si mesma, promover a proprietário, nem conceder o que não possui.
    expectError(() => updateMember(db, ctx("u-juliana"), juliana.id, { role: "owner", active: true, permissions: juliana.permissions }), "forbidden");
    expectError(() => updateMember(db, ctx("u-juliana"), raimundo.id, { role: "owner", active: true, permissions: raimundo.permissions }), "forbidden");
    expectError(() => updateMember(db, ctx("u-juliana"), raimundo.id, { role: "mechanic", active: true, permissions: [...raimundo.permissions, "finance.view"] }), "forbidden");
    expectError(() => updateMember(db, ctx("u-juliana"), carlos.id, { role: "owner", active: false, permissions: [] }), "forbidden");
    expectError(() => addMember(db, ctx("u-juliana"), { name: "Fulano", email: "fulano@demo.test", role: "owner" }), "forbidden");
    // Mas pode conceder algo que ela mesma possui.
    updateMember(db, ctx("u-juliana"), raimundo.id, { role: "mechanic", active: true, permissions: [...raimundo.permissions, "schedule.manage"] });
    expect(raimundo.permissions).toContain("schedule.manage");
  });

  it("funcionário inativo perde o acesso", () => {
    const wesley = db.memberships.find((m) => m.userId === "u-wesley")!;
    updateMember(db, ctx(), wesley.id, { role: "mechanic", active: false, permissions: wesley.permissions });
    const order = newOrder();
    expectError(() => changeOrderStatus(db, ctx("u-wesley"), order.id, "in_progress"), "forbidden");
  });
});

describe("crachá do funcionário", () => {
  const PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";
  it("cadastra com telefone e foto e depois edita nome, telefone e foto", () => {
    const m = addMember(db, ctx(), { name: "João Batista", email: "joao@demo.test", role: "mechanic", phone: "(85) 99999-1111", photo: PHOTO });
    const u = db.users.find((x) => x.id === m.userId)!;
    expect(u.phone).toBe("85999991111");
    expect(u.photo).toBe(PHOTO);
    updateMemberProfile(db, ctx(), m.id, { name: "João B. Lima", phone: "", photo: null });
    expect(u.name).toBe("João B. Lima");
    expect(u.phone).toBe("");
    expect(u.photo).toBeNull();
  });
  it("recusa foto que não é imagem e quem não gerencia funcionários", () => {
    const m = addMember(db, ctx(), { name: "Pedro", email: "pedro@demo.test", role: "mechanic" });
    expectError(() => updateMemberProfile(db, ctx(), m.id, { name: "Pedro", photo: "javascript:alert(1)" }), "validation");
    expectError(() => updateMemberProfile(db, ctx("u-raimundo"), m.id, { name: "Pedro" }), "forbidden");
  });
});

describe("PIN de entrada", () => {
  it("usa 1234 na demonstração, troca pelo dono e recusa PIN inválido ou de outra oficina", () => {
    expect(verifyPin(db, DEMO_WORKSHOP_ID, "u-juliana", DEMO_PIN)).toBe(true);
    expect(verifyPin(db, DEMO_WORKSHOP_ID, "u-juliana", "0000")).toBe(false);
    const m = db.memberships.find((x) => x.workshopId === DEMO_WORKSHOP_ID && x.userId === "u-juliana")!;
    setMemberPin(db, ctx(), m.id, "4821");
    expect(verifyPin(db, DEMO_WORKSHOP_ID, "u-juliana", "4821")).toBe(true);
    expect(verifyPin(db, DEMO_WORKSHOP_ID, "u-juliana", DEMO_PIN)).toBe(false);
    expect(verifyPin(db, SECOND_WORKSHOP_ID, "u-juliana", "4821")).toBe(false);
    expectError(() => setMemberPin(db, ctx(), m.id, "12a4"), "validation");
    expectError(() => setMemberPin(db, ctx("u-raimundo"), m.id, "1111"), "forbidden");
  });
});

describe("isolamento multiempresa", () => {
  it("a visão de uma oficina nunca inclui registros de outra", () => {
    const a = scopeTo(db, DEMO_WORKSHOP_ID);
    const b = scopeTo(db, SECOND_WORKSHOP_ID);
    for (const key of ["customers", "vehicles", "orders", "orderItems", "parts", "stockMovements", "appointments", "transactions", "payments", "memberships"] as const) {
      expect(a[key].length).toBeGreaterThan(0);
      expect(a[key].every((x) => x.workshopId === DEMO_WORKSHOP_ID)).toBe(true);
      expect(b[key].every((x) => x.workshopId === SECOND_WORKSHOP_ID)).toBe(true);
    }
    expect(a.users.some((u) => u.id === "u-marcos")).toBe(false);
  });

  it("impede operar e referenciar registros de outra oficina", () => {
    const foreignOrder = db.orders.find((o) => o.workshopId === SECOND_WORKSHOP_ID)!;
    const foreignPart = part("BAT-45", SECOND_WORKSHOP_ID);
    const foreignCustomer = db.customers.find((c) => c.workshopId === SECOND_WORKSHOP_ID)!;
    expectError(() => changeOrderStatus(db, ctx(), foreignOrder.id, "waiting"), "not_found");
    expectError(() => moveStock(db, ctx(), { partId: foreignPart.id, type: "in", quantity: 1, reason: "Teste" }), "not_found");
    expectError(
      () => createOrder(db, ctx(), {
        customer: { id: foreignCustomer.id },
        vehicle: { plate: "AAA1A11", brand: "Fiat", model: "Uno", year: null, mileage: null },
        description: "Teste", notes: "", mechanicId: null, laborCents: null, items: [],
      }),
      "not_found",
    );
    expectError(
      () => createOrder(db, ctx(), {
        customer: { name: "Fulano de Tal", phone: "85988887777" },
        vehicle: { plate: "AAA1A11", brand: "Fiat", model: "Uno", year: null, mileage: null },
        description: "Teste", notes: "", mechanicId: "u-davi", laborCents: null,
        items: [{ partId: foreignPart.id, quantity: 1, unitPriceCents: 100 }],
      }),
      "validation",
    );
    // Usuário de outra oficina não opera nesta.
    expectError(() => newOrderAs("u-marcos"), "forbidden");
  });

  it("numeração de OS e configurações são independentes por oficina", () => {
    const next = db.orderCounters[SECOND_WORKSHOP_ID];
    newOrder();
    expect(db.orderCounters[SECOND_WORKSHOP_ID]).toBe(next);
    updateSettings(db, ctx(), { displayName: "Nova Marca", phone: "", logoDataUrl: null, primaryColor: "#AA0000", secondaryColor: "#000000", activeModules: ["orders"] });
    expect(db.settings.find((s) => s.workshopId === SECOND_WORKSHOP_ID)!.displayName).toBe("Auto Elétrica Castelão");
    const mine = db.settings.find((s) => s.workshopId === DEMO_WORKSHOP_ID)!;
    expect(mine.activeModules).toEqual(["dashboard", "orders", "settings"]);
  });
});

function newOrderAs(userId: string) {
  return createOrder(db, ctx(userId), {
    customer: { name: "Fulano de Tal", phone: "85988887777" },
    vehicle: { plate: "AAA1A11", brand: "Fiat", model: "Uno", year: null, mileage: null },
    description: "Teste", notes: "", mechanicId: null, laborCents: null, items: [],
  });
}

describe("conectar o aparelho (decisões 74–75)", () => {
  it("separa e-mail desconhecido, funcionário e dono", async () => {
    const { checkEmail } = await import("@/services/auth");
    const db = buildSeed();
    expect(checkEmail(db, "ninguem@x.com").kind).toBe("unknown");
    expect(checkEmail(db, "juliana@oficinamodelo.demo").kind).toBe("not-owner");
    expect(checkEmail(db, "  Carlos@OficinaModelo.demo ").kind).toBe("owner");
  });
  it("o dono entra com a senha que a GAVYO entregou; a GAVYO troca a senha", async () => {
    const { checkPassword, setOwnerPassword } = await import("@/services/auth");
    const { DEMO_OWNER_PASSWORD } = await import("@/demo/seed");
    const db = buildSeed();
    expect(checkPassword(db, DEMO_OWNER_ID, DEMO_OWNER_PASSWORD)).toBe(true);
    expect(checkPassword(db, DEMO_OWNER_ID, "errada123")).toBe(false);
    expect(() => setOwnerPassword(db, DEMO_OWNER_ID, "curta")).toThrow();
    setOwnerPassword(db, DEMO_OWNER_ID, "senhaforte1");
    expect(checkPassword(db, DEMO_OWNER_ID, "senhaforte1")).toBe(true);
    expect(() => setOwnerPassword(db, "u-juliana", "senhaforte1")).toThrow();
  });
  it("quem não é dono não troca o PIN do dono", () => {
    const db = buildSeed();
    const juliana = db.memberships.find((m) => m.userId === "u-juliana")!;
    juliana.permissions.push("staff.manage");
    const ownerM = db.memberships.find((m) => m.userId === DEMO_OWNER_ID)!;
    expect(() => setMemberPin(db, { workshopId: DEMO_WORKSHOP_ID, userId: "u-juliana", now: new Date() }, ownerM.id, "0000")).toThrow(/proprietário/);
  });
});
