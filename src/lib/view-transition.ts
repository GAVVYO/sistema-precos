"use client";

import { flushSync } from "react-dom";

/**
 * Transições que mostram o que aconteceu (cartão que anda de coluna, cartão que
 * vira a janela, troca de oficina…), com a View Transitions API.
 *
 * Os nomes de transição só existem durante a troca: o CSS os liga por
 * `html[data-vt="<tipo>"]`. Sem suporte no navegador ou com movimento reduzido
 * (sistema ou Acessibilidade), a mudança acontece direto, sem animação.
 * Referências: Arc, Safari 18, Linear; Impeccable animate.
 */

type VT = { finished: Promise<void>; ready: Promise<void> };
type DocVT = Document & { startViewTransition?: (cb: () => void | Promise<void>) => VT };

export function motionReduced(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduce";
}

// Durante a transição o navegador não desenha quadros (requestAnimationFrame fica parado):
// espera só a fila de tarefas, onde os efeitos do React e o showModal() do diálogo já rodaram.
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Executa `update` dentro de uma transição do tipo `kind`.
 * `before` roda antes da foto do estado antigo; `after`, depois do novo estado montado.
 */
export function withTransition(
  kind: string,
  update: () => void,
  hooks: { before?: () => void; after?: () => void; done?: () => void; vars?: Record<string, string> } = {},
): void {
  const doc = document as DocVT;
  if (motionReduced() || !doc.startViewTransition || document.documentElement.dataset.vt) {
    update();
    hooks.done?.();
    return;
  }
  const root = document.documentElement;
  root.dataset.vt = kind;
  for (const [k, v] of Object.entries(hooks.vars ?? {})) root.style.setProperty(k, v);
  hooks.before?.();
  let t: VT;
  try {
    t = doc.startViewTransition(async () => {
      flushSync(update);
      // Diálogos nativos abrem em efeito; espera a fila para entrarem na foto nova.
      await tick();
      hooks.after?.();
    });
  } catch {
    delete root.dataset.vt;
    update();
    hooks.done?.();
    return;
  }
  t.finished.catch(() => {}).finally(() => {
    delete root.dataset.vt;
    for (const k of Object.keys(hooks.vars ?? {})) root.style.removeProperty(k);
    hooks.done?.();
  });
}

/** Nome de transição válido a partir de um id (só letras, números e hífen). */
export function vtName(prefix: string, id: string): string {
  return `${prefix}-${id.replace(/[^a-zA-Z0-9-]/g, "")}`;
}
