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

  it("movimento reduzido desliga os pseudo-elementos de brilho", () => {
    expect(css).toMatch(/data-motion="reduce"\][^{]*::(after|before)[^{]*\{[^}]*animation:\s*none/);
  });
});
