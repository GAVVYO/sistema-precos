/**
 * Senha e PIN (src/server/secrets.ts): conferidos sem travar o servidor
 * (scrypt assíncrono) e com o mesmo formato de antes — resumos já gravados
 * continuam valendo.
 */
import { randomBytes, scryptSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkSecret, hashSecret, isHashed } from "@/server/secrets";

describe("resumo de senha e PIN", () => {
  it("não trava o servidor: resumir e conferir devolvem Promise", () => {
    const h = hashSecret("1234");
    expect(h).toBeInstanceOf(Promise);
    expect(checkSecret("1234", null)).toBeInstanceOf(Promise);
    return h;
  });

  it("resumo novo confere", async () => {
    const h = await hashSecret("1234");
    expect(isHashed(h)).toBe(true);
    expect(await checkSecret("1234", h)).toBe(true);
    expect(await checkSecret("4321", h)).toBe(false);
  });

  it("resumo antigo (scryptSync) continua valendo", async () => {
    const salt = randomBytes(16).toString("base64url");
    const old = `scrypt$${salt}$${scryptSync("senha-antiga-1", salt, 32).toString("base64url")}`;
    expect(await checkSecret("senha-antiga-1", old)).toBe(true);
    expect(await checkSecret("senha-antiga-2", old)).toBe(false);
  });

  it("sem resumo ou resumo estragado: false, sem lançar erro", async () => {
    for (const s of [null, undefined, "", "texto", "scrypt$", "scrypt$a$", "scrypt$$"]) {
      expect(await checkSecret("x", s)).toBe(false);
    }
  });
});
