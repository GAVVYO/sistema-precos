import type { Cents, ID, ISODate, ServiceOrder } from "@/domain/types";
import { addDays, dateOf, inRange } from "@/lib/format";
import type { WorkshopView } from "./core";
import { orderTotals } from "./orders";

/**
 * Desempenho (decisão 77): só o que nenhuma outra tela mostra. Dinheiro do
 * caixa fica no Financeiro; aqui, quem fez, o que a oficina mais faz, quanto
 * vale um serviço e quais clientes voltam ou sumiram.
 */

export interface MechanicResult { userId: ID | null; name: string; count: number; totalCents: Cents; laborCents: Cents }
export interface ServiceKind { label: string; count: number; totalCents: Cents; avgCents: Cents }
export interface CustomerLine { customerId: ID; name: string; phone: string; visits: number; lastDate: ISODate; totalCents: Cents }

export interface Performance {
  count: number;
  totalCents: Cents;
  avgCents: Cents;
  /** Mesmo tamanho de período, imediatamente antes. */
  previous: { count: number; totalCents: Cents; avgCents: Cents };
  mechanics: MechanicResult[];
  services: ServiceKind[];
  /** Voltaram 2 vezes ou mais nos últimos 12 meses. */
  loyal: CustomerLine[];
  /** Último serviço há mais de 6 meses. */
  gone: CustomerLine[];
}

/** Serviço pronto (não cancelado) no período. */
const doneIn = (o: ServiceOrder, from: ISODate, to: ISODate) => !o.cancelledAt && o.status === "done" && !!o.completedAt && inRange(dateOf(o.completedAt), from, to);

const STOP = new Set(["de", "da", "do", "das", "dos", "e", "o", "a", "os", "as", "no", "na", "com", "para", "em", "-", "—"]);
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** "Troca de óleo e filtro" e "Troca de óleo" viram o mesmo grupo: as 2 primeiras palavras que importam. */
export function serviceKey(description: string): string {
  return plain(description).split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w)).slice(0, 2).join(" ");
}

function summarize(view: WorkshopView, orders: ServiceOrder[]) {
  const totalCents = orders.reduce((s, o) => s + orderTotals(view, o).totalCents, 0);
  return { count: orders.length, totalCents, avgCents: orders.length ? Math.round(totalCents / orders.length) : 0 };
}

export function buildPerformance(view: WorkshopView, from: ISODate, to: ISODate): Performance {
  const done = view.orders.filter((o) => doneIn(o, from, to));
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  const prevTo = addDays(from, -1);
  const prev = view.orders.filter((o) => doneIn(o, addDays(prevTo, -(days - 1)), prevTo));

  const byMech = new Map<string, MechanicResult>();
  for (const o of done) {
    const key = o.mechanicId ?? "";
    const r = byMech.get(key) ?? { userId: o.mechanicId, name: view.users.find((u) => u.id === o.mechanicId)?.name ?? "Sem mecânico", count: 0, totalCents: 0, laborCents: 0 };
    r.count += 1;
    r.totalCents += orderTotals(view, o).totalCents;
    r.laborCents += o.laborCents ?? 0;
    byMech.set(key, r);
  }

  const byKind = new Map<string, { labels: Map<string, number>; count: number; totalCents: Cents }>();
  for (const o of done) {
    const key = serviceKey(o.description) || plain(o.description);
    const g = byKind.get(key) ?? { labels: new Map(), count: 0, totalCents: 0 };
    g.count += 1;
    g.totalCents += orderTotals(view, o).totalCents;
    g.labels.set(o.description.trim(), (g.labels.get(o.description.trim()) ?? 0) + 1);
    byKind.set(key, g);
  }
  const services = [...byKind.values()]
    .map((g) => {
      // O nome do grupo é a descrição mais curta entre as mais usadas ("Troca de óleo").
      const label = [...g.labels.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0];
      return { label, count: g.count, totalCents: g.totalCents, avgCents: Math.round(g.totalCents / g.count) };
    })
    .sort((a, b) => b.count - a.count || b.totalCents - a.totalCents)
    .slice(0, 5);

  // Clientes: olha 12 meses para trás a partir do fim do período.
  const yearAgo = addDays(to, -365);
  const lines = new Map<ID, CustomerLine>();
  for (const o of view.orders) {
    if (o.cancelledAt) continue;
    const d = dateOf(o.openedAt);
    if (d > to) continue;
    const c = view.customers.find((x) => x.id === o.customerId);
    if (!c) continue;
    const l = lines.get(c.id) ?? { customerId: c.id, name: c.name, phone: c.phone, visits: 0, lastDate: d, totalCents: 0 };
    if (d >= yearAgo) { l.visits += 1; l.totalCents += orderTotals(view, o).totalCents; }
    if (d > l.lastDate) l.lastDate = d;
    lines.set(c.id, l);
  }
  const all = [...lines.values()];
  const sixMonths = addDays(to, -180);

  return {
    ...summarize(view, done),
    previous: summarize(view, prev),
    mechanics: [...byMech.values()].sort((a, b) => b.totalCents - a.totalCents),
    services,
    loyal: all.filter((l) => l.visits >= 2).sort((a, b) => b.visits - a.visits || b.totalCents - a.totalCents).slice(0, 5),
    gone: all.filter((l) => l.lastDate < sixMonths).sort((a, b) => b.lastDate.localeCompare(a.lastDate)).slice(0, 5),
  };
}
