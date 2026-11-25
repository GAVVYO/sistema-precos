/** Corpo dos pedidos (src/server/http.ts): limite de tamanho antes de ler tudo na memória. */
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { body, MAX_BODY_BYTES } from "@/server/http";

const req = (text: string, headers: Record<string, string> = {}) =>
  new NextRequest("http://x/api/acoes", { method: "POST", body: text, headers: { "content-type": "application/json", ...headers } });

describe("body", () => {
  it("aceita lote com 4 fotos de 2 MB", async () => {
    const foto = "A".repeat(Math.ceil((2_000_000 * 4) / 3)); // 2 MB em base64
    const got = await body<{ f: string[] }>(req(JSON.stringify({ f: [foto, foto, foto, foto] })));
    expect(got.f).toHaveLength(4);
  });

  it("recusa acima do limite pelo content-length, sem ler o corpo", async () => {
    await expect(body(req("{}", { "content-length": String(MAX_BODY_BYTES + 1) }))).rejects.toThrow("Pedido grande demais");
  });

  it("recusa acima do limite mesmo sem content-length", async () => {
    await expect(body(req(JSON.stringify({ x: "A".repeat(MAX_BODY_BYTES) })))).rejects.toThrow("Pedido grande demais");
  });

  it("JSON inválido continua 'Pedido inválido.'", async () => {
    await expect(body(req("{"))).rejects.toThrow("Pedido inválido.");
  });
});
