/** Limpeza de sessões/tentativas: se falhar, a entrada que já deu certo continua valendo. */
import type { PoolConnection } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";
import { purgeExpired } from "@/server/auth";

describe("purgeExpired", () => {
  it("erro do banco (ex.: deadlock) não derruba quem acabou de entrar", async () => {
    const c = { query: vi.fn().mockRejectedValue(Object.assign(new Error("Deadlock found"), { code: "ER_LOCK_DEADLOCK" })) } as unknown as PoolConnection;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(purgeExpired(c)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
