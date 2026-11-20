/**
 * Store da demonstração: mantém o "banco" fictício em memória, persiste em
 * localStorage e notifica a interface. Substituído na fase 2 por chamadas
 * ao backend (Route Handlers + Prisma/MySQL).
 *
 * A sessão aqui é apenas um seletor de usuário fictício — NÃO é autenticação.
 */
import type { Database, ID } from "@/domain/types";
import { bindCommands, type Commands } from "@/services/commands";
import { Ctx, DomainError, membershipOf } from "@/services/core";
import { demoHash } from "@/services/auth";
import { buildSeed, DEMO_OWNER_ID, DEMO_OWNER_PASSWORD, DEMO_WORKSHOP_ID } from "./seed";

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
        // Dados salvos antes da decisão 87 não têm fotos.
        saved.db.orderPhotos ??= [];
        // Dados salvos antes da decisão 75: donos sem senha recebem a senha da demonstração.
        const owners = new Set(saved.db.memberships.filter((m) => m.role === "owner").map((m) => m.userId));
        saved.db.users.forEach((u) => { if (owners.has(u.id) && !u.passwordHash) u.passwordHash = demoHash(DEMO_OWNER_PASSWORD); });
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

/**
 * Outra aba (ex.: a TV da parede) recebe as mudanças feitas nesta. Só o banco é
 * sincronizado: cada aba mantém o próprio usuário e o próprio estado de conexão.
 */
let syncing = false;
function listenOtherTabs() {
  if (syncing || typeof window === "undefined") return;
  syncing = true;
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue || !state) return;
    try {
      const saved = JSON.parse(e.newValue) as Partial<DemoState>;
      if (saved.db?.version !== 1) return;
      state = { ...state, db: saved.db, lastSyncAt: saved.lastSyncAt ?? state.lastSyncAt };
      listeners.forEach((l) => l());
    } catch {
      /* valor inválido de outra aba: ignora */
    }
  });
}

export const demoStore = {
  subscribe(listener: () => void) {
    listenOtherTabs();
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
      throw new DomainError("offline", "Sem internet. Tente de novo quando a internet voltar.");
    }
    if (!s.session) throw new DomainError("forbidden", "Sessão encerrada. Entre novamente.");
    const draft = structuredClone(s.db);
    const result = fn(draft, { ...s.session, now: new Date() });
    set({ ...s, db: draft, lastSyncAt: new Date().toISOString() });
    return result;
  },

  /** Ações com nome (mesma forma do servidor). */
  run<T>(fn: (c: Commands) => T): T {
    return this.mutate((db, ctx) => fn(bindCommands(db, ctx)));
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
