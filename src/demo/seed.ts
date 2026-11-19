/**
 * Dados de demonstração (fictícios).
 *
 * O seed é construído executando os MESMOS serviços usados pela interface,
 * com datas relativas ao dia atual. Assim toda OS paga tem sua receita,
 * e toda peça usada tem a movimentação de estoque correspondente.
 */
import { demoHash } from "@/services/auth";
import { ALL_MODULES, ROLE_TEMPLATES } from "@/domain/permissions";
import type { Database, ID, PaymentMethod, Role } from "@/domain/types";
import { addDays, fortalezaInstant, todayISO } from "@/lib/format";
import { createAppointment, setAppointmentStatus } from "@/services/appointments";
import type { Ctx } from "@/services/core";
import { createExpense, createIncome } from "@/services/finance";
import { cancelOrder, changeOrderStatus, createOrder, registerPayment } from "@/services/orders";
import { createPart } from "@/services/stock";

export const DEMO_WORKSHOP_ID = "ws-passare";
export const SECOND_WORKSHOP_ID = "ws-castelao";
export const DEMO_OWNER_ID = "u-carlos";
/** Senha do dono que já fez o primeiro acesso (Castelão), mostrada na demonstração. */
export const DEMO_OWNER_PASSWORD = "gavyo2026";

export function emptyDatabase(): Database {
  return {
    version: 1,
    workshops: [],
    settings: [],
    users: [],
    memberships: [],
    customers: [],
    vehicles: [],
    orders: [],
    orderItems: [],
    orderEvents: [],
    parts: [],
    stockMovements: [],
    appointments: [],
    transactions: [],
    payments: [],
    orderCounters: {},
  };
}

function addWorkshop(
  db: Database,
  w: { id: ID; name: string; slug: string; phone: string; primary: string; secondary: string },
  staff: { id: ID; name: string; email: string; role: Role }[],
  createdAt: string,
) {
  db.workshops.push({ id: w.id, name: w.name, slug: w.slug, createdAt });
  db.settings.push({
    workshopId: w.id,
    displayName: w.name,
    phone: w.phone,
    logoDataUrl: null,
    primaryColor: w.primary,
    secondaryColor: w.secondary,
    activeModules: [...ALL_MODULES],
  });
  db.orderCounters[w.id] = 1;
  for (const s of staff) {
    db.users.push({ id: s.id, name: s.name, email: s.email });
    db.memberships.push({
      id: `m-${s.id}`,
      workshopId: w.id,
      userId: s.id,
      role: s.role,
      active: true,
      permissions: [...ROLE_TEMPLATES[s.role]],
    });
  }
}

interface SeedOrder {
  daysAgo: number;
  /** Horas antes de "agora" para ordens de hoje. */
  hoursAgo?: number;
  customer: [name: string, phone: string];
  vehicle: [plate: string, brand: string, model: string, year: number, km: number];
  description: string;
  mechanic: ID | null;
  labor: number | null;
  parts: [code: string, qty: number][];
  status: "waiting" | "in_progress" | "done";
  pay?: PaymentMethod;
  cancel?: string;
  notes?: string;
}

export function buildSeed(now: Date = new Date()): Database {
  const db = emptyDatabase();
  const today = todayISO(now);
  const at = (daysAgo: number, time = "09:00") => new Date(fortalezaInstant(addDays(today, -daysAgo), time));

  addWorkshop(
    db,
    { id: DEMO_WORKSHOP_ID, name: "Oficina Modelo Passaré", slug: "oficina-modelo-passare", phone: "85988880001", primary: "#2563EB", secondary: "#172033" },
    [
      { id: DEMO_OWNER_ID, name: "Carlos Henrique Lima", email: "carlos@oficinamodelo.demo", role: "owner" },
      { id: "u-juliana", name: "Juliana Sousa", email: "juliana@oficinamodelo.demo", role: "receptionist" },
      { id: "u-raimundo", name: "Raimundo Nonato Silva", email: "raimundo@oficinamodelo.demo", role: "mechanic" },
      { id: "u-wesley", name: "Francisco Wesley Costa", email: "wesley@oficinamodelo.demo", role: "mechanic" },
      { id: "u-ana", name: "Ana Paula Ferreira", email: "ana@oficinamodelo.demo", role: "financial" },
    ],
    at(120).toISOString(),
  );
  addWorkshop(
    db,
    { id: SECOND_WORKSHOP_ID, name: "Auto Elétrica Castelão", slug: "auto-eletrica-castelao", phone: "85988880002", primary: "#0F766E", secondary: "#1F2937" },
    [
      { id: "u-marcos", name: "Marcos Vinícius Rocha", email: "marcos@castelao.demo", role: "owner" },
      { id: "u-davi", name: "Davi Lucas Almeida", email: "davi@castelao.demo", role: "mechanic" },
    ],
    at(60).toISOString(),
  );
  // Castelão já fez o primeiro acesso (tem senha); a Oficina Modelo ainda não (decisão 74).
  db.users.find((u) => u.id === "u-marcos")!.passwordHash = demoHash(DEMO_OWNER_PASSWORD);

  seedWorkshop(db, now, DEMO_WORKSHOP_ID, DEMO_OWNER_ID, {
    parts: [
      ["FIL-001", "Filtro de óleo", "Filtros", 24, 5, 1800, 3500],
      ["FIL-002", "Filtro de ar", "Filtros", 12, 4, 2500, 4990],
      ["FIL-003", "Filtro de combustível", "Filtros", 8, 4, 2200, 4500],
      ["OLE-001", "Óleo 5W30 sintético 1L", "Lubrificantes", 36, 12, 3200, 5800],
      ["OLE-002", "Óleo 15W40 mineral 1L", "Lubrificantes", 24, 12, 2100, 3900],
      ["FRE-001", "Pastilha de freio dianteira (jogo)", "Freios", 6, 4, 6500, 12900],
      ["FRE-002", "Disco de freio dianteiro (par)", "Freios", 3, 2, 18000, 32000],
      ["FRE-003", "Fluido de freio DOT4 500 ml", "Freios", 6, 4, 1900, 3800],
      ["ELE-001", "Bateria 60 Ah", "Elétrica", 3, 2, 33000, 52000],
      ["ELE-002", "Lâmpada H4", "Elétrica", 12, 6, 1400, 2900],
      ["ELE-003", "Vela de ignição (jogo)", "Elétrica", 3, 3, 7000, 13000],
      ["MOT-001", "Correia dentada", "Motor", 2, 3, 8500, 16000],
      ["SUS-001", "Amortecedor dianteiro", "Suspensão", 2, 2, 21000, 36000],
      ["OUT-001", "Palheta do limpador (par)", "Outros", 7, 4, 2800, 5500],
    ],
    orders: [
      { daysAgo: 12, customer: ["Maria do Socorro Alves", "85987651201"], vehicle: ["HXA4B21", "Fiat", "Uno", 2012, 148200], description: "Troca de óleo e filtro", mechanic: "u-raimundo", labor: 6000, parts: [["OLE-002", 3], ["FIL-001", 1]], status: "done", pay: "pix" },
      { daysAgo: 9, customer: ["José Airton Pereira", "85996432210"], vehicle: ["OSD7F34", "Volkswagen", "Gol", 2015, 97400], description: "Revisão completa com troca de filtros", mechanic: "u-wesley", labor: 18000, parts: [["OLE-001", 4], ["FIL-001", 1], ["FIL-002", 1], ["FIL-003", 1]], status: "done", pay: "card" },
      { daysAgo: 7, customer: ["Antônia Lúcia Barbosa", "85985127733"], vehicle: ["PNB2C87", "Chevrolet", "Onix", 2019, 61300], description: "Troca de pastilhas e discos de freio dianteiros", mechanic: "u-raimundo", labor: 15000, parts: [["FRE-001", 1], ["FRE-002", 1]], status: "done", pay: "cash" },
      { daysAgo: 6, customer: ["Pedro Ivo Nogueira", "85991340058"], vehicle: ["NUT5A19", "Ford", "Ka", 2016, 88900], description: "Troca de correia dentada", mechanic: "u-wesley", labor: 22000, parts: [["MOT-001", 1]], status: "waiting", cancel: "Cliente desistiu do serviço" },
      { daysAgo: 5, customer: ["Francisco das Chagas Moura", "85988215540"], vehicle: ["ORK3D65", "Toyota", "Corolla", 2017, 112700], description: "Troca dos amortecedores dianteiros", mechanic: "u-raimundo", labor: 20000, parts: [["SUS-001", 2]], status: "done" },
      { daysAgo: 3, customer: ["Luciana Castro Menezes", "85992876614"], vehicle: ["POX8E02", "Hyundai", "HB20", 2020, 43800], description: "Troca de bateria", mechanic: "u-wesley", labor: 4000, parts: [["ELE-001", 1]], status: "done", pay: "pix" },
      { daysAgo: 2, customer: ["Pedro Ivo Nogueira", "85991340058"], vehicle: ["NUT5A19", "Ford", "Ka", 2016, 88950], description: "Diagnóstico elétrico — falha intermitente na partida", mechanic: "u-wesley", labor: null, parts: [], status: "in_progress", notes: "Cliente relata que o problema ocorre com o motor quente." },
      { daysAgo: 1, customer: ["Renata Cavalcante Dias", "85986603391"], vehicle: ["PMZ1G46", "Renault", "Sandero", 2018, 74100], description: "Alinhamento e balanceamento", mechanic: "u-raimundo", labor: 12000, parts: [], status: "done" },
      { daysAgo: 0, hoursAgo: 3, customer: ["José Airton Pereira", "85996432210"], vehicle: ["SBA6H12", "Fiat", "Strada", 2021, 38600], description: "Revisão de freios e troca de fluido", mechanic: "u-wesley", labor: 9000, parts: [["FRE-003", 1]], status: "in_progress" },
      { daysAgo: 0, hoursAgo: 2, customer: ["Sebastião Gomes Teixeira", "85989457726"], vehicle: ["HWK9321", "Chevrolet", "Celta", 2010, 171500], description: "Troca de óleo", mechanic: "u-raimundo", labor: 5000, parts: [["OLE-002", 3], ["FIL-001", 1]], status: "waiting" },
      { daysAgo: 0, hoursAgo: 1, customer: ["Larissa Maia Pinheiro", "85994018865"], vehicle: ["QRT4J58", "Jeep", "Renegade", 2019, 66200], description: "Troca de lâmpadas e palhetas", mechanic: null, labor: null, parts: [["ELE-002", 2], ["OUT-001", 1]], status: "waiting" },
    ],
    expenses: [
      [10, "Aluguel do galpão", "Aluguel", 90000, "transfer"],
      [8, "Conta de energia", "Energia", 28000, "pix"],
      [6, "Reposição de filtros e óleo", "Compra de peças", 45000, "pix"],
      [4, "Conta de água", "Água", 8500, "pix"],
      [2, "Jogo de chaves combinadas", "Ferramentas", 12000, "card"],
    ],
    appointments: [
      [0, "14:00", "Maria do Socorro Alves", "85987651201", "HXA4B21", "Fiat", "Uno", "Troca de óleo", "u-raimundo", "confirmed"],
      [0, "15:30", "Gilberto Farias Lopes", "85993372204", "PNF7K90", "Volkswagen", "Voyage", "Revisão dos 60 mil km", "u-wesley", "scheduled"],
      [0, "16:30", "Tereza Cristina Bezerra", "85987706643", "", "Honda", "Fit", "Alinhamento", null, "scheduled"],
      [-1, "09:00", "Antônia Lúcia Barbosa", "85985127733", "PNB2C87", "Chevrolet", "Onix", "Diagnóstico elétrico — luz da injeção", "u-wesley", "scheduled"],
      [-2, "10:30", "Rafael Mendes Queiroz", "85996650912", "OCB3L77", "Fiat", "Palio", "Troca de bateria", null, "scheduled"],
      [-4, "08:30", "Luciana Castro Menezes", "85992876614", "POX8E02", "Hyundai", "HB20", "Revisão de freios", "u-raimundo", "confirmed"],
      [1, "11:00", "Renata Cavalcante Dias", "85986603391", "PMZ1G46", "Renault", "Sandero", "Alinhamento e balanceamento", "u-raimundo", "attended"],
      [3, "15:00", "Paulo Sérgio Viana", "85988123345", "", "Ford", "Fiesta", "Troca de óleo", null, "cancelled"],
    ],
  });
  createIncome(db, { workshopId: DEMO_WORKSHOP_ID, userId: "u-ana", now: at(4, "11:20") }, { description: "Venda de sucata metálica", amountCents: 15000, date: addDays(today, -4), method: "cash", status: "paid", customerId: null });

  seedWorkshop(db, now, SECOND_WORKSHOP_ID, "u-marcos", {
    parts: [
      ["BAT-45", "Bateria 45 Ah", "Elétrica", 5, 2, 27000, 43000],
      ["ALT-01", "Regulador de voltagem", "Elétrica", 4, 2, 6000, 11500],
      ["LAM-H7", "Lâmpada H7", "Elétrica", 3, 6, 1700, 3400],
      ["FUS-KIT", "Kit de fusíveis", "Elétrica", 15, 5, 900, 2200],
    ],
    orders: [
      { daysAgo: 4, customer: ["Edilson Monteiro Braga", "85987114420"], vehicle: ["OIA2M41", "Fiat", "Siena", 2014, 133000], description: "Troca de bateria e teste do alternador", mechanic: "u-davi", labor: 5000, parts: [["BAT-45", 1]], status: "done", pay: "pix" },
      { daysAgo: 1, customer: ["Vanessa Lima Portela", "85995520871"], vehicle: ["PMK8N15", "Chevrolet", "Prisma", 2017, 80400], description: "Diagnóstico elétrico — vidro elétrico não sobe", mechanic: "u-davi", labor: 8000, parts: [["FUS-KIT", 1]], status: "done" },
      { daysAgo: 0, hoursAgo: 2, customer: ["Cícero Romão Batista Neto", "85991203367"], vehicle: ["HYD5512", "Volkswagen", "Saveiro", 2011, 190300], description: "Farol baixo não acende", mechanic: "u-davi", labor: null, parts: [["LAM-H7", 2]], status: "in_progress" },
    ],
    expenses: [
      [7, "Aluguel do ponto", "Aluguel", 60000, "transfer"],
      [3, "Multímetro digital", "Ferramentas", 18000, "pix"],
    ],
    appointments: [
      [0, "15:00", "Vanessa Lima Portela", "85995520871", "PMK8N15", "Chevrolet", "Prisma", "Instalação de alarme", "u-davi", "confirmed"],
      [-1, "10:00", "Edilson Monteiro Braga", "85987114420", "OIA2M41", "Fiat", "Siena", "Revisão elétrica", null, "scheduled"],
    ],
  });

  return db;
}

interface WorkshopSeed {
  parts: [code: string, name: string, category: string, qty: number, min: number, cost: number, price: number][];
  orders: SeedOrder[];
  expenses: [daysAgo: number, description: string, category: string, cents: number, method: PaymentMethod][];
  /** daysAgo negativo = futuro. */
  appointments: [daysAgo: number, time: string, name: string, phone: string, plate: string, brand: string, model: string, service: string, mechanic: ID | null, status: "scheduled" | "confirmed" | "attended" | "cancelled"][];
}

function seedWorkshop(db: Database, now: Date, workshopId: ID, ownerId: ID, seed: WorkshopSeed) {
  const today = todayISO(now);
  const ctxAt = (date: Date): Ctx => ({ workshopId, userId: ownerId, now: date });
  const at = (daysAgo: number, time: string) => new Date(fortalezaInstant(addDays(today, -daysAgo), time));

  for (const [code, name, category, qty, min, cost, price] of seed.parts) {
    createPart(db, ctxAt(at(30, "08:00")), {
      code, name, category, description: "", minQuantity: min, costCents: cost, priceCents: price, initialQuantity: qty,
    });
  }
  const partByCode = (code: string) => db.parts.find((p) => p.workshopId === workshopId && p.code === code)!;

  for (const o of seed.orders) {
    const opened = o.daysAgo === 0 ? new Date(now.getTime() - (o.hoursAgo ?? 1) * 3_600_000) : at(o.daysAgo, "08:40");
    const later = (hours: number) =>
      o.daysAgo === 0 ? new Date(opened.getTime() + hours * 600_000) : new Date(opened.getTime() + hours * 3_600_000);
    const [name, phone] = o.customer;
    const [plate, brand, model, year, mileage] = o.vehicle;
    const order = createOrder(db, ctxAt(opened), {
      customer: { name, phone },
      vehicle: { plate, brand, model, year, mileage },
      description: o.description,
      notes: o.notes ?? "",
      mechanicId: o.mechanic,
      laborCents: o.labor,
      mileage,
      items: o.parts.map(([code, quantity]) => ({ partId: partByCode(code).id, quantity, unitPriceCents: partByCode(code).priceCents })),
    });
    if (o.cancel) {
      cancelOrder(db, ctxAt(later(2)), order.id, { reason: o.cancel, returnParts: true });
      continue;
    }
    if (o.status !== "waiting") changeOrderStatus(db, ctxAt(later(1)), order.id, "in_progress");
    if (o.status === "done") changeOrderStatus(db, ctxAt(later(6)), order.id, "done");
    if (o.pay) registerPayment(db, ctxAt(later(7)), order.id, { method: o.pay });
  }

  for (const [daysAgo, description, category, amountCents, method] of seed.expenses) {
    createExpense(db, ctxAt(at(daysAgo, "17:00")), { description, category, amountCents, date: addDays(today, -daysAgo), method, notes: "" });
  }

  for (const [daysAgo, time, customerName, phone, plate, brand, model, service, mechanicId, status] of seed.appointments) {
    const ctx = ctxAt(at(Math.max(daysAgo, 0) + 2, "10:00"));
    const a = createAppointment(db, ctx, { customerName, phone, plate, brand, model, service, date: addDays(today, -daysAgo), time, mechanicId, notes: "" });
    if (status !== "scheduled") setAppointmentStatus(db, ctx, a.id, status);
  }
}
