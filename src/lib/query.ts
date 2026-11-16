/** Busca inicial passada pela URL (?q=), usada quando a busca global abre um módulo já filtrado. */
export function initialQuery(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("q") ?? "";
}
