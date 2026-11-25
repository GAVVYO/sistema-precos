/** Cabeçalhos de segurança do servidor (next.config.ts). */
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("next.config", () => {
  it("servidor manda cabeçalhos de segurança em todas as páginas", async () => {
    const { default: cfg } = await import("../next.config");
    const rules = await cfg.headers!();
    const all = rules.filter((h) => h.source === "/:path*").flatMap((h) => h.headers.map((x) => x.key.toLowerCase()));
    expect(all).toEqual(expect.arrayContaining(["x-frame-options", "x-content-type-options", "referrer-policy", "permissions-policy"]));
    const perms = rules.flatMap((h) => h.headers).find((x) => x.key.toLowerCase() === "permissions-policy")!.value;
    expect(perms).toContain("camera=(self)"); // o app tira foto e lê QR
  });

  it("export estático (Hostinger simples) não declara cabeçalhos", async () => {
    vi.stubEnv("STATIC_EXPORT", "1");
    const { default: cfg } = await import("../next.config");
    expect(cfg.headers).toBeUndefined();
  });
});
