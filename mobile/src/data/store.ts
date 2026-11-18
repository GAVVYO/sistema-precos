import { useSyncExternalStore } from "react";
import { buildSeed, DEMO_WORKSHOP_ID } from "@core/demo/seed";
import type { Database, ID, PermissionKey } from "@core/domain/types";
import { type Ctx, DomainError, scopeTo } from "@core/services/core";

/**
 * Dados de demonstração do app: o MESMO seed e as MESMAS regras do site.
 * Cada ação roda sobre uma cópia do banco e só vale se não der erro
 * (igual ao demoStore.mutate do site). Por enquanto em memória;
 * na E1 passa a gravar no aparelho (AsyncStorage).
 */

interface State { db: Database; userId: ID; workshopId: ID }

let state: State = { db: buildSeed(), userId: "u-juliana", workshopId: DEMO_WORKSHOP_ID };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function act(fn: (db: Database, ctx: Ctx) => void): { ok: true } | { ok: false; message: string } {
  const copy = structuredClone(state.db);
  try {
    fn(copy, { userId: state.userId, workshopId: state.workshopId, now: new Date() });
  } catch (e) {
    return { ok: false, message: e instanceof DomainError ? e.message : "Não deu certo. Tente de novo." };
  }
  state = { ...state, db: copy };
  emit();
  return { ok: true };
}

export function enterAs(userId: ID) {
  const m = state.db.memberships.find((x) => x.userId === userId && x.active);
  if (!m) return;
  state = { ...state, userId, workshopId: m.workshopId };
  emit();
}

export function resetDemo() {
  state = { ...state, db: buildSeed() };
  emit();
}

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const snapshot = () => state;

/** Tudo que as telas precisam: dados da oficina, quem está usando e o que pode fazer. */
export function useApp() {
  const s = useSyncExternalStore(subscribe, snapshot, snapshot);
  const view = scopeTo(s.db, s.workshopId);
  const user = s.db.users.find((u) => u.id === s.userId)!;
  const membership = view.memberships.find((m) => m.userId === s.userId)!;
  const can = (p: PermissionKey) => membership.permissions.includes(p);
  return {
    db: s.db,
    view,
    user,
    membership,
    can,
    customerOf: (id: ID) => view.customers.find((c) => c.id === id),
    vehicleOf: (id: ID) => view.vehicles.find((v) => v.id === id),
    userOf: (id: ID | null) => (id ? view.users.find((u) => u.id === id) : undefined),
    partOf: (id: ID) => view.parts.find((p) => p.id === id),
  };
}
