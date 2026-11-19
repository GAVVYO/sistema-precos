import "./polyfills";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { buildSeed, DEMO_WORKSHOP_ID } from "@core/demo/seed";
import { ROLE_TEMPLATES } from "@core/domain/permissions";
import type { Database, ID, PermissionKey } from "@core/domain/types";
import type { Pairing, PairingProfile } from "@core/services/pairing";
import { type Ctx, DomainError, scopeTo } from "@core/services/core";

/**
 * Dados de demonstração do app: o MESMO seed e as MESMAS regras do site.
 * Cada ação roda sobre uma cópia do banco e só vale se não der erro
 * (igual ao demoStore.mutate do site). Por enquanto em memória;
 * na E1 passa a gravar no aparelho (AsyncStorage).
 */

/**
 * Como este celular está ligado à oficina (decisão 76), guardado no aparelho:
 * - `person`: celular de uma pessoa (entrou pelo QR pessoal); abre com digital ou PIN;
 * - `shared`: aparelho da oficina (QR do balcão); abre em "Quem está entrando?".
 * Fase 2: em vez dos dados, uma chave do servidor guardada no cofre do aparelho.
 */
export type Device =
  | { mode: "person"; workshopId: ID; userId: ID; profile?: PairingProfile }
  | { mode: "shared"; workshopId: ID; lastUserId?: ID };

interface State { db: Database; userId: ID; workshopId: ID; signedIn: boolean; device: Device | null; deviceLoaded: boolean }

let state: State = { db: buildSeed(), userId: "u-juliana", workshopId: DEMO_WORKSHOP_ID, signedIn: false, device: null, deviceLoaded: false };
const DEVICE_KEY = "gavyo:device:v1";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function act(fn: (db: Database, ctx: Ctx) => void): { ok: true } | { ok: false; message: string } {
  // structuredClone pode faltar em versões do Hermes; JSON basta (o banco é só dados).
  const copy: Database = typeof structuredClone === "function" ? structuredClone(state.db) : JSON.parse(JSON.stringify(state.db));
  try {
    fn(copy, { userId: state.userId, workshopId: state.workshopId, now: new Date() });
  } catch (e) {
    return { ok: false, message: e instanceof DomainError ? e.message : "Não deu certo. Tente de novo." };
  }
  state = { ...state, db: copy };
  emit();
  return { ok: true };
}

/** Entrou com o PIN certo (a conferência é feita pela tela, com verifyPin do site). */
export function enterAs(userId: ID, workshopId?: ID) {
  const m = state.db.memberships.find((x) => x.userId === userId && x.active && (!workshopId || x.workshopId === workshopId));
  if (!m) return;
  state = { ...state, userId, workshopId: m.workshopId, signedIn: true };
  emit();
}

/** Demonstração: quem foi cadastrado no site chega pelo QR com nome, e-mail e função. */
function adopt(db: Database, workshopId: ID, userId: ID, profile?: PairingProfile) {
  if (!profile || db.memberships.some((m) => m.workshopId === workshopId && m.userId === userId)) return;
  if (!db.users.some((u) => u.id === userId)) db.users.push({ id: userId, name: profile.name, email: profile.email });
  db.memberships.push({ id: `m-${userId}-${workshopId}`, workshopId, userId, role: profile.role, active: true, permissions: [...ROLE_TEMPLATES[profile.role]] });
}

function saveDevice(device: Device | null) {
  (device ? AsyncStorage.setItem(DEVICE_KEY, JSON.stringify(device)) : AsyncStorage.removeItem(DEVICE_KEY)).catch(() => {
    /* sem armazenamento: o celular pede o QR de novo na próxima vez */
  });
}

/** Ao abrir o app: lê como este celular está ligado à oficina. */
export async function loadDevice() {
  let device: Device | null = null;
  try {
    const raw = await AsyncStorage.getItem(DEVICE_KEY);
    device = raw ? (JSON.parse(raw) as Device) : null;
  } catch { device = null; }
  const db = state.db;
  if (device && !db.workshops.some((w) => w.id === device!.workshopId)) device = null;
  if (device?.mode === "person") adopt(db, device.workshopId, device.userId, device.profile);
  state = { ...state, device, deviceLoaded: true, workshopId: device?.workshopId ?? state.workshopId };
  emit();
}

/** Leu o QR: liga o celular à oficina (e à pessoa, no QR pessoal). */
export function connectDevice(p: Pairing): Device {
  const db = state.db;
  const device: Device = p.kind === "person" ? { mode: "person", workshopId: p.workshopId, userId: p.userId, profile: p.profile } : { mode: "shared", workshopId: p.workshopId };
  if (device.mode === "person") adopt(db, device.workshopId, device.userId, device.profile);
  state = { ...state, db: { ...db }, device, workshopId: device.workshopId };
  saveDevice(device);
  emit();
  return device;
}

/** Desliga o celular da oficina (volta para "Conectar com QR"). */
export function disconnectDevice() {
  state = { ...state, device: null, signedIn: false };
  saveDevice(null);
  emit();
}

/** Aparelho compartilhado: lembra quem entrou por último (já vem aberto no PIN). */
export function rememberLastUser(userId: ID) {
  if (state.device?.mode !== "shared") return;
  const device: Device = { ...state.device, lastUserId: userId };
  state = { ...state, device };
  saveDevice(device);
}

export function signOut() {
  state = { ...state, signedIn: false };
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
  // Na tela de entrada ainda não há ninguém dentro (membership pode não existir nesta oficina).
  const can = (p: PermissionKey) => membership?.permissions.includes(p) ?? false;
  return {
    signedIn: s.signedIn,
    device: s.device,
    deviceLoaded: s.deviceLoaded,
    workshopId: s.workshopId,
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
