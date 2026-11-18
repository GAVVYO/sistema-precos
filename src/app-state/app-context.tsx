"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { withTransition } from "@/lib/view-transition";
import { ORDER_CLOSED_EVENT } from "@/lib/born";
import { toast } from "@/components/ui/toast";
import { Connection, demoStore, DemoState } from "@/demo/store";
import type {
  Customer, Database, ID, Part, PermissionKey, User, Vehicle, WorkshopMembership, WorkshopSettings,
} from "@/domain/types";
import { can as canDo, Ctx, DomainError, scopeTo, WorkshopView } from "@/services/core";

/** Estado bruto da demonstração (null durante a renderização no servidor). */
export function useDemoState(): DemoState | null {
  return useSyncExternalStore(
    demoStore.subscribe,
    () => demoStore.getState(),
    () => demoStore.getServerState(),
  );
}

export type ActResult<T> = { ok: true; value: T } | { ok: false };

export interface NewOrderPrefill {
  appointmentId?: ID;
  customerId?: ID;
  vehicleId?: ID;
  customerName?: string;
  phone?: string;
  plate?: string;
  brand?: string;
  model?: string;
  description?: string;
  mechanicId?: ID | null;
}

interface AppValue {
  db: Database;
  view: WorkshopView;
  user: User;
  membership: WorkshopMembership;
  settings: WorkshopSettings;
  connection: Connection;
  online: boolean;
  lastSyncAt: string;
  can: (permission: PermissionKey) => boolean;
  /** Executa uma operação de escrita, exibindo aviso de sucesso ou erro. */
  act: <T>(fn: (db: Database, ctx: Ctx) => T, successMessage?: string) => ActResult<T>;
  customerOf: (id: ID | null) => Customer | undefined;
  vehicleOf: (id: ID | null) => Vehicle | undefined;
  userOf: (id: ID | null) => User | undefined;
  partOf: (id: ID | null) => Part | undefined;
  /** Funcionários ativos que podem ser responsáveis por serviços. */
  mechanics: User[];
  openOrderId: ID | null;
  openOrder: (id: ID | null) => void;
  newOrder: NewOrderPrefill | null;
  openNewOrder: (prefill?: NewOrderPrefill) => void;
  closeNewOrder: () => void;
}

const AppContext = createContext<AppValue | null>(null);

export function useApp(): AppValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp deve ser usado dentro de AppProvider.");
  return value;
}

function byId<T extends { id: ID }>(list: T[]): Map<ID, T> {
  return new Map(list.map((x) => [x.id, x]));
}

export function AppProvider({ state, children }: { state: DemoState; children: ReactNode }) {
  const session = state.session!;
  const { db } = state;
  const [openOrderId, setOpenOrderId] = useState<ID | null>(null);
  const openRef = useRef<ID | null>(null);
  useEffect(() => { openRef.current = openOrderId; }, [openOrderId]);
  // O cartão (ou o botão clicado) cresce e vira a janela do serviço; ao fechar, ela encolhe de volta.
  const openOrder = useCallback((id: ID | null) => {
    const card = (oid: ID | null) => (oid ? document.querySelector<HTMLElement>(`.kanban-board [data-order-id="${oid}"]`) : null);
    if (id) {
      const active = document.activeElement;
      const src = card(id) ?? (active instanceof HTMLElement && active !== document.body && !active.closest("dialog") ? active : null);
      if (!src || document.querySelector("dialog[open]")) return setOpenOrderId(id);
      withTransition("open", () => { src.classList.remove("vt-hero"); setOpenOrderId(id); }, { before: () => src.classList.add("vt-hero") });
    } else {
      const closed = () => window.dispatchEvent(new Event(ORDER_CLOSED_EVENT));
      const dest = card(openRef.current);
      if (!dest) { setOpenOrderId(null); window.setTimeout(closed, 0); return; }
      withTransition("close", () => { setOpenOrderId(null); dest.classList.add("vt-hero"); }, { done: () => { dest.classList.remove("vt-hero"); closed(); } });
    }
  }, []);
  const [newOrder, setNewOrder] = useState<NewOrderPrefill | null>(null);

  const view = useMemo(() => scopeTo(db, session.workshopId), [db, session.workshopId]);
  const maps = useMemo(
    () => ({
      customers: byId(view.customers),
      vehicles: byId(view.vehicles),
      users: byId(view.users),
      parts: byId(view.parts),
    }),
    [view],
  );

  const act = useCallback(<T,>(fn: (db: Database, ctx: Ctx) => T, successMessage?: string): ActResult<T> => {
    try {
      const value = demoStore.mutate(fn);
      if (successMessage) toast("success", successMessage);
      return { ok: true, value };
    } catch (e) {
      if (e instanceof DomainError) {
        toast("error", e.message);
      } else {
        console.error(e);
        toast("error", "Ocorreu um erro inesperado. Tente novamente.");
      }
      return { ok: false };
    }
  }, []);

  const value = useMemo<AppValue>(() => {
    const membership = view.memberships.find((m) => m.userId === session.userId)!;
    const mechanicIds = new Set(
      view.memberships.filter((m) => m.active && (m.role === "mechanic" || m.role === "owner")).map((m) => m.userId),
    );
    return {
      db,
      view,
      user: maps.users.get(session.userId)!,
      membership,
      settings: view.settings!,
      connection: state.connection,
      online: state.connection === "online",
      lastSyncAt: state.lastSyncAt,
      can: (p) => canDo(db, session, p),
      act,
      customerOf: (id) => (id ? maps.customers.get(id) : undefined),
      vehicleOf: (id) => (id ? maps.vehicles.get(id) : undefined),
      userOf: (id) => (id ? maps.users.get(id) : undefined),
      partOf: (id) => (id ? maps.parts.get(id) : undefined),
      mechanics: view.users.filter((u) => mechanicIds.has(u.id)),
      openOrderId,
      openOrder,
      newOrder,
      openNewOrder: (prefill) => setNewOrder(prefill ?? {}),
      closeNewOrder: () => setNewOrder(null),
    };
  }, [db, view, maps, session, state.connection, state.lastSyncAt, act, openOrderId, openOrder, newOrder]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
