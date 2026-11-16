/**
 * Store da demonstração: mantém o "banco" fictício em memória, persiste em
 * localStorage e notifica a interface. Substituído na fase 2 por chamadas
 * ao backend (Route Handlers + Prisma/MySQL).
 *
 * A sessão aqui é apenas um seletor de usuário fictício — NÃO é autenticação.
 */
import type { Database, ID } from "@/domain/types";
import { Ctx, DomainError, membershipOf } from "@/services/core";
import { buildSeed, DEMO_OWNER_ID, DEMO_WORKSHOP_ID } from "./seed";

const STORAGE_KEY = "gavyo-auto:demo:v1";

export type Connection = "online" | "offline" | "reconnecting";

export interface DemoSession {
  userId: ID;
  workshopId: ID;
}

export interface DemoState {
  db: Database;
  session: DemoSession | null;
  connection: Connection;
  /** Última vez em que os dados foram atualizados com sucesso. */
  lastSyncAt: string;
}

let state: DemoState | null = null;
const listeners = new Set<() => void>();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function persist() {
  if (!state || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ db: state.db, session: state.session, lastSyncAt: state.lastSyncAt }),
    );
  } catch {
    // Armazenamento cheio ou bloqueado: a demonstração segue em memória.
  }
}

function load(): DemoState {
  const fresh = (): DemoState => ({
    db: buildSeed(),
    session: null,
    connection: "online",
    lastSyncAt: new Date().toISOString(),
  });
  if (typeof localStorage === "undefined") return fresh();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<DemoState>;
      if (saved.db?.version === 1 && Array.isArray(saved.db.workshops)) {
        return {
          db: saved.db,
          session: saved.session ?? null,
          connection: typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "online",
          lastSyncAt: saved.lastSyncAt ?? new Date().toISOString(),
        };
      }
    }
  } catch {
    // Dados corrompidos: recomeça com o seed.
  }
  const s = fresh();
  state = s;
  persist();
  return s;
}

function set(next: DemoState) {
  state = next;
  persist();
  listeners.forEach((l) => l());
}

export const demoStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getState(): DemoState {
    if (!state) state = load();
    return state;
  },
  /** Durante a renderização no servidor não há dados locais. */
  getServerState(): DemoState | null {
    return null;
  },

  login(workshopId: ID, userId: ID) {
    const s = this.getState();
    if (!membershipOf(s.db, { workshopId, userId })) {
      throw new DomainError("forbidden", "Usuário sem acesso ativo a esta oficina.");
    }
    set({ ...s, session: { workshopId, userId } });
  },
  logout() {
    set({ ...this.getState(), session: null });
  },

  /**
   * Executa uma operação de escrita de forma atômica: roda sobre uma cópia do
   * banco e só confirma se terminar sem erro (equivalente a uma transação).
   */
  mutate<T>(fn: (db: Database, ctx: Ctx) => T): T {
    const s = this.getState();
    if (s.connection !== "online") {
      throw new DomainError("offline", "Sem conexão. Alterações ficam bloqueadas até a conexão voltar.");
    }
    if (!s.session) throw new DomainError("forbidden", "Sessão encerrada. Entre novamente.");
    const draft = structuredClone(s.db);
    const result = fn(draft, { ...s.session, now: new Date() });
    set({ ...s, db: draft, lastSyncAt: new Date().toISOString() });
    return result;
  },

  /** Simula queda e retorno da conexão. Ao voltar, passa por "reconectando". */
  setOnline(online: boolean) {
    const s = this.getState();
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (!online) {
      set({ ...s, connection: "offline" });
      return;
    }
    if (s.connection === "online") return;
    set({ ...s, connection: "reconnecting" });
    reconnectTimer = setTimeout(() => {
      set({ ...this.getState(), connection: "online", lastSyncAt: new Date().toISOString() });
    }, 1200);
  },

  resetDemo() {
    const s = this.getState();
    set({
      db: buildSeed(),
      session: s.session ? { workshopId: DEMO_WORKSHOP_ID, userId: DEMO_OWNER_ID } : null,
      connection: "online",
      lastSyncAt: new Date().toISOString(),
    });
  },
};
