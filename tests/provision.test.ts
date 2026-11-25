/** Criar a demonstração: PIN conferido antes de qualquer consulta ao banco. */
import { describe, expect, it } from "vitest";
import { createDemoWorkshop } from "@/server/provision";

describe("createDemoWorkshop", () => {
  for (const pin of ["123", "12345", "abcd", ""]) {
    it(`PIN "${pin}" é recusado`, async () => {
      await expect(createDemoWorkshop("dono@x.com", "senha-boa-123", pin)).rejects.toThrow("O PIN tem 4 números.");
    });
  }
});
