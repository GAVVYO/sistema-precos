/**
 * Regras de animação leve (docs/ANIMACOES.md › Desempenho): o que anima a cada
 * quadro só pode ser transform/opacity — sombra, fundo e tamanho animados
 * obrigam o navegador a repintar (ou recalcular a página) a cada quadro.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/app/globals.css", "utf8");
const keyframes = [...css.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g)].map((m) => ({ name: m[1], body: m[2] }));
const CARAS = /(?:^|[{;\s])(box-shadow|background(?:-color)?|width|height|top|left|margin|padding)\s*:/;

describe("animações leves", () => {
  it("nenhum keyframe anima propriedade de pintura/layout", () => {
    // clip-path é usado de propósito nas revelações (troca de oficina, QR); fica de fora.
    expect(keyframes.filter((k) => CARAS.test(k.body)).map((k) => k.name)).toEqual([]);
  });

  it("nada usa transition: all", () => {
    expect(css).not.toMatch(/transition:\s*all\b/);
  });

  it(".with-sidebar não anima padding-left (a View Transition já anima)", () => {
    // "transition: none" (movimento reduzido) pode; transição de verdade, não.
    expect(css).not.toMatch(/\.with-sidebar\s*\{[^}]*transition(?!:\s*none)/);
  });

  it("brilhos continuam na cor da oficina/etapa", () => {
    // A regra que roda cada brilho (animation: <nome>) também usa a variável de cor dele.
    const blocks = css.split("}");
    const cor = { "card-glow": "--primary", "tv-live": "--tv-done", "tv-fresh": "--c", "tab-got": "--st" };
    for (const [nome, v] of Object.entries(cor)) {
      expect(blocks.some((b) => new RegExp(`animation:[^;]*\\b${nome}\\b`).test(b) && b.includes(`var(${v}`)), nome).toBe(true);
    }
  });

  it("vidro: desfoque até 8px, sem saturate, e nunca vidro dentro de vidro", () => {
    // O desfoque é recalculado a cada quadro de rolagem; o fundo já é 90%+ opaco.
    const blurs = [...css.matchAll(/(?<!-webkit-)backdrop-filter:\s*([^;]+);/g)].map((m) => m[1]);
    for (const b of blurs) {
      expect(Number(/blur\((\d+)px\)/.exec(b)?.[1] ?? 0), b).toBeLessThanOrEqual(8);
      expect(b).not.toMatch(/saturate/);
    }
    expect(css).not.toMatch(/\.island-search-slot \.order-search\s*\{[^}]*backdrop-filter/);
  });

  it("movimento reduzido desliga os pseudo-elementos de brilho", () => {
    expect(css).toMatch(/data-motion="reduce"\][^{]*::(after|before)[^{]*\{[^}]*animation:\s*none/);
  });
});
