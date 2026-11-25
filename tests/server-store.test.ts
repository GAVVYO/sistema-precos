/**
 * Fila de envio para o servidor (src/app-state/server-store.ts): a ação que a
 * tela já mostrou não pode sumir quando o servidor está reiniciando (502/503/504),
 * e uma resposta estragada não pode travar a fila para sempre.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSeed, DEMO_WORKSHOP_ID } from "@/demo/seed";

vi.mock("@/components/ui/toast", () => ({ toast: vi.fn() }));

const OWNER = buildSeed().memberships.find((m) => m.workshopId === DEMO_WORKSHOP_ID && m.role === "owner")!.userId;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const ok = (from: number) => json({ from, version: from + 1, changes: { upserts: {}, deletes: {} } });

/** Respostas de /api/acoes, na ordem; /api/estado sempre devolve a oficina na versão 1. */
function server(acoes: (() => Response)[]) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (url: string) => {
    calls.push(url);
    if (url.startsWith("/api/estado")) return json({ session: { workshopId: DEMO_WORKSHOP_ID, userId: OWNER }, version: 1, db: buildSeed() });
    const next = acoes.shift();
    if (!next) throw new Error(`sem resposta preparada para ${url}`);
    return next();
  });
  vi.stubGlobal("fetch", fetchMock);
  return { acoes: () => calls.filter((c) => c === "/api/acoes").length };
}

async function load() {
  vi.resetModules();
  const mod = await import("@/app-state/server-store");
  const { toast } = await import("@/components/ui/toast");
  await mod.serverStore.reload();
  return { ...mod, toast: toast as unknown as ReturnType<typeof vi.fn> };
}

const novoCliente = (nome: string) => (c: import("@/services/commands").Commands) => c.createCustomer({ name: nome, phone: "(85) 98888-1111" });

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", { setInterval: () => 0, addEventListener: () => {} });
  vi.stubGlobal("document", { visibilityState: "visible", addEventListener: () => {} });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("fila de envio", () => {
  it("retryDelay cresce e para em 30 s", async () => {
    const { retryDelay } = await import("@/app-state/server-store");
    expect([0, 1, 2, 3, 9].map(retryDelay)).toEqual([4000, 8000, 16000, 30000, 30000]);
  });

  it("503, 503 e depois 200: a ação é enviada de novo, uma vez só, e a fila esvazia", async () => {
    const s = server([() => json({ error: "x" }, 503), () => json({ error: "x" }, 503), () => ok(1)]);
    const { serverStore, retryDelay, toast } = await load();
    serverStore.run(novoCliente("Cliente da Fila"));
    await vi.advanceTimersByTimeAsync(0);
    expect(s.acoes()).toBe(1);
    expect(serverStore.pending()).toBe(1);
    await vi.advanceTimersByTimeAsync(retryDelay(0));
    expect(s.acoes()).toBe(2);
    await vi.advanceTimersByTimeAsync(retryDelay(1));
    expect(s.acoes()).toBe(3);
    expect(serverStore.pending()).toBe(0);
    expect(toast).not.toHaveBeenCalledWith("error", expect.anything());
  });

  it("504 (o servidor pode ter gravado): não reenvia; busca a versão do servidor e avisa para conferir", async () => {
    const s = server([() => json({ error: "x" }, 504)]);
    const { serverStore, toast } = await load();
    const estadoAntes = vi.mocked(fetch).mock.calls.filter(([u]) => String(u).startsWith("/api/estado")).length;
    serverStore.run(novoCliente("Talvez Salvo"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(s.acoes()).toBe(1);
    expect(serverStore.pending()).toBe(0);
    expect(vi.mocked(fetch).mock.calls.filter(([u]) => String(u).startsWith("/api/estado")).length).toBe(estadoAntes + 1);
    expect(toast).toHaveBeenCalledWith("error", expect.stringMatching(/confira/i));
  });

  it("resposta 200 com corpo estragado não trava a fila", async () => {
    const s = server([() => new Response("<html>cortado", { status: 200 }), () => ok(1)]);
    const { serverStore } = await load();
    serverStore.run(novoCliente("Primeiro"));
    await vi.advanceTimersByTimeAsync(0);
    expect(serverStore.pending()).toBe(0);
    serverStore.run(novoCliente("Segundo"));
    await vi.advanceTimersByTimeAsync(0);
    expect(s.acoes()).toBe(2);
    expect(serverStore.pending()).toBe(0);
  });

  it("sessão encerrada: aviso não manda digitar o PIN (o aparelho pode ter sido desconectado)", async () => {
    // Depois de trocar a senha do dono, o aparelho precisa de e-mail e senha, não de PIN.
    server([() => json({ error: "Sessão encerrada. Entre novamente.", code: "forbidden" }, 403)]);
    const { serverStore, toast } = await load();
    serverStore.run(novoCliente("Depois da troca"));
    await vi.advanceTimersByTimeAsync(0);
    expect(serverStore.getState()!.session).toBeNull();
    const msg = vi.mocked(toast).mock.calls.find(([kind]) => kind === "error")?.[1] as string;
    expect(msg).toMatch(/sessão terminou/i);
    expect(msg).not.toMatch(/PIN/);
  });

  it("erro de regra (409) continua tirando a ação da fila com aviso", async () => {
    const s = server([() => json({ error: "Peça acabou." }, 409)]);
    const { serverStore, toast } = await load();
    serverStore.run(novoCliente("Recusado"));
    await vi.advanceTimersByTimeAsync(0);
    expect(s.acoes()).toBe(1);
    expect(serverStore.pending()).toBe(0);
    expect(toast).toHaveBeenCalledWith("error", "Não foi salvo: Peça acabou.");
  });
});
