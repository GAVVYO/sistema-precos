import { describe, expect, it } from "vitest";
import { accessibilityKey, DEFAULT_ACCESSIBILITY, parseAccessibility } from "@/lib/accessibility";
import { readableAccent } from "@/lib/theme";

describe("preferências pessoais de acessibilidade", () => {
  it.each(["", "{", "null", "[]", "42", '"texto"'])("recupera o padrão ao ler %s", raw => {
    expect(parseAccessibility(raw)).toEqual(DEFAULT_ACCESSIBILITY);
  });

  it("aceita somente valores conhecidos sem coerção de tipos", () => {
    expect(parseAccessibility(JSON.stringify({ textSize: "300%", contrast: "true", spacing: 1, motion: "always", reading: false, injected: true }))).toEqual(DEFAULT_ACCESSIBILITY);
    expect(parseAccessibility(JSON.stringify({ textSize: "larger", contrast: true, spacing: true, motion: "reduce", reading: true }))).toEqual({ textSize: "larger", contrast: true, spacing: true, motion: "reduce", reading: true });
  });

  it("separa o mesmo usuário entre oficinas e usuários da mesma oficina", () => {
    expect(new Set([accessibilityKey("oficina-a", "user-a"), accessibilityKey("oficina-b", "user-a"), accessibilityKey("oficina-a", "user-b")]).size).toBe(3);
  });
});

describe("contraste da cor personalizável", () => {
  const contrastOnWhite = (hex: string) => {
    const rgb = hex.slice(1).match(/../g)!.map(c => Number.parseInt(c, 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
    return 1.05 / (rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 + .05);
  };

  it.each(["#ffffff", "#ffff00", "#00ff00", "#2563eb", "#0f766e", "#b45309", "#000000"])("garante contraste de texto para %s", color => {
    expect(contrastOnWhite(readableAccent(color))).toBeGreaterThanOrEqual(5.5);
    expect(contrastOnWhite(readableAccent(color, 7))).toBeGreaterThanOrEqual(7);
  });

  it("preserva uma cor que já oferece contraste suficiente", () => {
    expect(readableAccent("#172033")).toBe("#172033");
  });
});
