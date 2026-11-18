import type { ServiceOrder, Vehicle } from "@core/domain/types";
import { addDays, dateOf, formatTime, todayISO } from "@core/lib/format";
import type { WorkshopView } from "@core/services/core";
import { orderTotals, paymentSituation } from "@core/services/orders";

export const vehicleLabel = (v?: Vehicle) => (v ? `${v.brand} ${v.model}`.trim() : "Carro");

/** "Chegou 9:40", "Chegou ontem", "Há 3 dias" (igual ao pátio do site). */
export function sinceShop(openedAt: string): string {
  const d = dateOf(openedAt);
  const today = todayISO();
  if (d === today) return `Chegou ${formatTime(openedAt)}`;
  if (d === addDays(today, -1)) return "Chegou ontem";
  return `Há ${Math.round((Date.parse(today) - Date.parse(d)) / 86400000)} dias`;
}

export function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

const byOpened = (a: ServiceOrder, b: ServiceOrder) => a.openedAt.localeCompare(b.openedAt);

/** Carros na oficina: abertos + prontos que ainda não foram pagos. */
export function yard(view: WorkshopView) {
  const active = view.orders.filter((o) => !o.cancelledAt);
  const owes = (o: ServiceOrder) => paymentSituation(o, orderTotals(view, o)) === "pending";
  const inShop = active.filter((o) => o.status !== "done" || owes(o));
  return {
    waiting: inShop.filter((o) => o.status === "waiting").sort(byOpened),
    doing: inShop.filter((o) => o.status === "in_progress").sort(byOpened),
    ready: inShop.filter((o) => o.status === "done").sort(byOpened),
    cars: new Set(inShop.map((o) => o.vehicleId)).size,
  };
}
