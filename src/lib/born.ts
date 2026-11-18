"use client";

/**
 * Serviços recém-abertos: o cartão "nasce" (pop + brilho) na primeira vez que
 * aparece de verdade no quadro — ao fechar a janela do serviço ou ao abrir a aba
 * Serviços. Vale por 2 minutos e uma única vez.
 */
const born = new Map<string, number>();
export const ORDER_CLOSED_EVENT = "gavyo:order-closed";

export function markBorn(id: string) {
  born.set(id, Date.now());
}

export function takeBorn(id: string): boolean {
  const t = born.get(id);
  if (!t) return false;
  born.delete(id);
  return Date.now() - t < 120_000;
}

export function isBorn(id: string): boolean {
  const t = born.get(id);
  return !!t && Date.now() - t < 120_000;
}
