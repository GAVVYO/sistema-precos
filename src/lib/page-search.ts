import { useSyncExternalStore } from "react";

/**
 * Busca do topo compartilhada com a tela de Serviços (decisão 92): lá a busca do
 * topo vira o filtro da lista — uma busca só, em vez de duas.
 */
let value = "";
const listeners = new Set<() => void>();

export function setPageSearch(next: string) {
  if (next === value) return;
  value = next;
  listeners.forEach((l) => l());
}

export function usePageSearch(): string {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => value,
    () => "",
  );
}
