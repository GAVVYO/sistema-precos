"use client";

import { motionReduced } from "./view-transition";

/**
 * Comemoração do recebimento: um check verde se desenha onde a pessoa clicou,
 * moedas estouram em volta e o valor "voa" até a aba Financeiro (ou Hoje), que
 * dá um pulinho ao receber. Só feedback visual: o aviso escrito continua.
 * Com movimento reduzido, nada acontece.
 */
export function celebratePayment(from: DOMRect, amount: string): void {
  if (motionReduced()) return;
  const layer = document.createElement("div");
  layer.className = "celebrate-layer";
  layer.setAttribute("aria-hidden", "true");
  const cx = from.left + from.width / 2;
  const cy = from.top + from.height / 2;
  layer.innerHTML = `
    <div class="celebrate-check" style="left:${cx}px;top:${cy}px">
      <svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27 l8 8 l15 -17"/></svg>
    </div>
    ${Array.from({ length: 12 }, (_, i) => `<i class="celebrate-coin" style="left:${cx}px;top:${cy}px;--a:${i * 30}deg;--d:${48 + (i % 3) * 16}px"></i>`).join("")}
    <span class="celebrate-amount" style="left:${cx}px;top:${cy}px">+ ${amount}</span>`;
  document.body.appendChild(layer);

  const chip = layer.querySelector<HTMLElement>(".celebrate-amount")!;
  const target = document.querySelector<HTMLElement>("[data-tour=nav-finance]") ?? document.querySelector<HTMLElement>("[data-tour=nav-dashboard]");
  const t = target?.getBoundingClientRect();
  const dx = t ? t.left + t.width / 2 - cx : 0;
  const dy = t ? t.top + t.height / 2 - cy : -120;
  chip.animate(
    [
      { transform: "translate(-50%, -50%) scale(.6)", opacity: 0 },
      { transform: "translate(-50%, calc(-50% - 46px)) scale(1.1)", opacity: 1, offset: 0.3 },
      { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 70}px)) scale(1)`, opacity: 1, offset: 0.65 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.35)`, opacity: 0.2 },
    ],
    { duration: 900, delay: 150, easing: "cubic-bezier(.45,0,.2,1)", fill: "both" },
  ).finished.then(() => {
    target?.animate([{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: 380, easing: "cubic-bezier(.34,1.56,.64,1)" });
    layer.remove();
  }).catch(() => layer.remove());
  window.setTimeout(() => layer.remove(), 2200);
}
