"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useRef, useState } from "react";

/**
 * Paginação para listas longas (decisão 64). A página volta para a 1 sozinha
 * quando a busca, o filtro ou a aba mudam (`resetKey`).
 */
export function usePager<T>(items: T[], pageSize: number, key?: string) {
  // Sem chave explícita: muda quando a lista filtrada muda (tamanho ou primeiro item).
  const resetKey = key ?? `${items.length}:${String((items[0] as { id?: string } | undefined)?.id ?? "")}`;
  const [state, setState] = useState({ key: resetKey, page: 1 });
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = state.key !== resetKey ? 1 : Math.min(state.page, pages);
  const start = (current - 1) * pageSize;
  return {
    page: current,
    pages,
    total: items.length,
    pageSize,
    start,
    items: items.slice(start, start + pageSize),
    setPage: (p: number) => setState({ key: resetKey, page: Math.max(1, Math.min(pages, p)) }),
  };
}

/** Números visíveis: 1 … 4 5 6 … 12 */
function pageList(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => { if (i && p - sorted[i - 1] > 1) out.push("…"); out.push(p); });
  return out;
}

export function Pager({ pager, label, noun = "itens" }: { pager: ReturnType<typeof usePager<unknown>>; label: string; noun?: string }) {
  const ref = useRef<HTMLElement>(null);
  if (pager.total <= pager.pageSize) return null;
  const go = (p: number) => {
    pager.setPage(p);
    // Volta para o começo da lista para a pessoa não ficar no fim da página.
    const list = ref.current?.parentElement;
    window.setTimeout(() => list?.scrollIntoView({ block: "start", behavior: "smooth" }), 0);
  };
  const from = pager.start + 1;
  const to = Math.min(pager.start + pager.pageSize, pager.total);
  return (
    <nav ref={ref} className="pager" aria-label={`Páginas de ${label}`}>
      <p className="pager-info" aria-live="polite">Mostrando <strong>{from} a {to}</strong> de {pager.total} {noun}</p>
      <div className="pager-controls">
        <button type="button" className="pager-step" disabled={pager.page === 1} onClick={() => go(pager.page - 1)}>
          <CaretLeft size={16} weight="bold" aria-hidden />Anterior
        </button>
        <span className="pager-pages">
          {pageList(pager.page, pager.pages).map((p, i) => p === "…"
            ? <span key={`e${i}`} className="pager-gap" aria-hidden>…</span>
            : <button key={p} type="button" className="pager-num" aria-current={p === pager.page ? "page" : undefined} aria-label={`Página ${p}`} onClick={() => go(p)}>{p}</button>)}
        </span>
        <button type="button" className="pager-step" disabled={pager.page === pager.pages} onClick={() => go(pager.page + 1)}>
          Próxima<CaretRight size={16} weight="bold" aria-hidden />
        </button>
      </div>
    </nav>
  );
}
