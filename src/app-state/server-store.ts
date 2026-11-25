import { toast } from "@/components/ui/toast";
import type { Database, ID } from "@/domain/types";
import { type CommandBatch, type Commands, recordCommands, replayCommands } from "@/services/commands";
import { DomainError } from "@/services/core";
import { applyChanges, type Changes, emptyDatabase } from "@/services/sync";
import type { Connection, DemoState } from "@/demo/store";

/**
 * Dados vindos do servidor (decisão 97), com a mesma cara do store da
 * demonstração para as telas não mudarem.
 *
 * - **Na hora:** a ação roda sobre uma cópia e a tela muda sem esperar.
 * - **Em fila:** os lotes vão ao servidor um de cada vez, na ordem.
 * - **Confirmado:** o servidor devolve as mudanças; a tela passa a mostrar a
 *   versão do servidor mais o que ainda está na fila. Se o servidor recusar
 *   (ex.: outra pessoa usou a última peça), a ação some e aparece o aviso.
 * - **Outras pessoas:** a cada 10 s (e ao voltar para a aba) busca se a versão mudou.
 */

interface Session { workshopId: ID; userId: ID }

let state: DemoState | null = null;
let confirmed: { version: number; db: Database } | null = null;
const queue: CommandBatch[] = [];
let sending = false;
let started = false;
let retry: ReturnType<typeof setTimeout> | null = null;
/** Muda ao sair: respostas que chegarem depois são ignoradas. */
let gen = 0;
const listeners = new Set<() => void>();

function set(next: DemoState) {
  state = next;
  listeners.forEach((l) => l());
}

function patch(p: Partial<DemoState>) {
  if (state) set({ ...state, ...p });
}

export async function api(path: string, body?: unknown): Promise<Response> {
  return fetch(path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: body === undefined ? undefined : { "content-type": "application/json", "x-gavyo": "1" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function errorText(res: Response): Promise<string> {
  try {
    return ((await res.json()) as { error?: string }).error ?? "Não deu certo. Tente de novo.";
  } catch {
    return "Não deu certo. Tente de novo.";
  }
}

/** Versão do servidor + o que ainda está na fila (ação que não vale mais sai com aviso). */
function rebuild() {
  if (!state?.session || !confirmed) return;
  const db = structuredClone(confirmed.db);
  const ctx = { ...state.session, now: new Date() };
  for (let i = 0; i < queue.length; i++) {
    try {
      replayCommands(db, ctx, queue[i]);
    } catch (e) {
      queue.splice(i--, 1);
      toast("error", `Não foi salvo: ${e instanceof DomainError ? e.message : "tente de novo."}`);
    }
  }
  patch({ db });
}

function signedOut() {
  gen++;
  queue.length = 0;
  confirmed = null;
  set({ db: emptyDatabase(), session: null, connection: "online", lastSyncAt: new Date().toISOString() });
}

/** Busca tudo da oficina (ou só confirma que nada mudou). */
async function pull(full = false): Promise<void> {
  const v = !full && confirmed ? `?v=${confirmed.version}` : "";
  const g = gen;
  let res: Response;
  try {
    res = await api(`/api/estado${v}`);
    if (g !== gen) return;
  } catch {
    if (state) patch({ connection: "offline" });
    else set({ db: emptyDatabase(), session: null, connection: "offline", lastSyncAt: new Date().toISOString() });
    return;
  }
  if (res.status === 403 || res.status === 401) return signedOut();
  if (res.status === 204) {
    patch({ connection: "online", lastSyncAt: new Date().toISOString() });
    return;
  }
  if (!res.ok) return;
  const data = (await res.json()) as { session: Session | null; version: number; db: Database };
  if (g !== gen) return;
  if (!data.session) return signedOut();
  confirmed = { version: data.version, db: data.db };
  set({ db: data.db, session: data.session, connection: "online", lastSyncAt: new Date().toISOString() });
  rebuild();
}

/** Servidor reiniciando ou fora do ar por instantes: a ação fica na fila e vai de novo. */
export const RETRY_STATUS = new Set([502, 503, 504]);

/** Espera antes de tentar de novo: 4 s, 8 s, 16 s… no máximo 30 s. */
export function retryDelay(attempt: number): number {
  return Math.min(4000 * 2 ** attempt, 30_000);
}
let attempts = 0;

function retryLater(connection: Connection) {
  patch({ connection });
  if (retry) clearTimeout(retry);
  retry = setTimeout(() => { retry = null; patch({ connection: "reconnecting" }); void flush(); }, retryDelay(attempts++));
}

async function flush(): Promise<void> {
  if (sending || !queue.length || !state?.session) return;
  if (retry) { clearTimeout(retry); retry = null; }
  sending = true;
  const batch = queue[0];
  const g = gen;
  // Tudo dentro do try/finally: nenhum erro inesperado deixa a fila travada em "enviando".
  try {
    let res: Response;
    try {
      res = await api("/api/acoes", batch);
    } catch {
      // Sem internet: guarda a fila e tenta de novo daqui a pouco.
      if (g === gen) retryLater("offline");
      return;
    }
    if (g !== gen) return;
    if (RETRY_STATUS.has(res.status)) return retryLater("reconnecting");
    attempts = 0;
    if (res.ok) {
      // Resposta cortada no caminho: o servidor pode ter gravado; a versão dele é que vale.
      const r = (await res.json().catch(() => null)) as { from: number; version: number; changes: Changes } | null;
      queue.shift();
      if (r && confirmed && state?.session && r.from === confirmed.version) {
        confirmed = { version: r.version, db: applyChanges(confirmed.db, r.changes, state.session.workshopId) };
        patch({ connection: "online", lastSyncAt: new Date().toISOString() });
        rebuild();
      } else {
        await pull(true);
      }
    } else if (res.status === 401 || (res.status === 403 && /Sessão encerrada/.test(await res.clone().text()))) {
      signedOut();
      toast("error", "Sua sessão terminou. Entre de novo com o PIN.");
      return;
    } else {
      queue.shift();
      toast("error", `Não foi salvo: ${await errorText(res)}`);
      rebuild();
    }
  } catch (e) {
    console.error(e);
  } finally {
    sending = false;
  }
  void flush();
}

function startPolling() {
  if (started || typeof window === "undefined") return;
  started = true;
  const tick = () => {
    if (document.visibilityState === "visible" && state?.session && !sending && !queue.length) void pull();
  };
  window.setInterval(tick, 10_000);
  document.addEventListener("visibilitychange", tick);
  window.addEventListener("online", () => serverStore.setOnline(true));
  window.addEventListener("offline", () => serverStore.setOnline(false));
}

export const serverStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getState(): DemoState | null {
    if (!state && !started) {
      startPolling();
      void pull(true);
    }
    return state;
  },
  getServerState(): DemoState | null {
    return null;
  },
  /** Depois de entrar (PIN ou e-mail do dono): carrega a oficina. */
  async reload(): Promise<void> {
    confirmed = null;
    await pull(true);
  },
  logout() {
    void api("/api/sair", {}).catch(() => {});
    signedOut();
  },
  run<T>(fn: (c: Commands) => T): T {
    if (!state?.session || !confirmed) throw new DomainError("forbidden", "Sessão encerrada. Entre novamente.");
    if (state.connection === "offline") throw new DomainError("offline", "Sem internet. Tente de novo quando a internet voltar.");
    const draft = structuredClone(state.db);
    const { value, batch } = recordCommands(draft, { ...state.session, now: new Date() }, fn);
    if (batch.calls.length) {
      queue.push(batch);
      patch({ db: draft });
      void flush();
    }
    return value;
  },
  setOnline(online: boolean) {
    if (!state) return;
    if (!online) return patch({ connection: "offline" });
    patch({ connection: "reconnecting" });
    void (queue.length ? flush() : pull());
  },
  /** Há algo esperando o servidor confirmar (para avisar antes de fechar a aba). */
  pending(): number {
    return queue.length;
  },
};

export type { Connection };
