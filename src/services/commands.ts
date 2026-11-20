import type { Database, ID } from "@/domain/types";
import { addMember, setMemberPin, updateMember, updateMemberProfile, updateSettings } from "./admin";
import { createAppointment, setAppointmentStatus, updateAppointment } from "./appointments";
import { type Ctx, DomainError, withIds } from "./core";
import { createCustomer, saveVehicle, updateCustomer } from "./customers";
import { createExpense, createIncome, settleIncome } from "./finance";
import { cancelOrder, changeOrderStatus, createOrder, registerPayment, setOrderItems, updateOrder } from "./orders";
import { addOrderPhoto, deleteOrderPhoto, moveOrderPhoto } from "./photos";
import { createPart, moveStock, setPartPhoto, updatePart } from "./stock";

/**
 * Ações com nome (Fase 2, etapa 1).
 *
 * Toda escrita da interface passa por aqui: `act((c) => c.createCustomer({...}))`.
 * Cada chamada roda na hora sobre uma cópia do banco (a tela muda na hora) e fica
 * anotada com o nome, os argumentos e os IDs que gerou. O servidor recebe essa
 * lista e repete as MESMAS funções sobre o banco de verdade, com a sessão dele —
 * nunca recebe dados prontos do navegador. Só os nomes desta lista são aceitos.
 */
export const COMMANDS = {
  updateSettings, updateMember, updateMemberProfile, addMember, setMemberPin,
  createAppointment, updateAppointment, setAppointmentStatus,
  createCustomer, updateCustomer, saveVehicle,
  createExpense, createIncome, settleIncome,
  createOrder, updateOrder, setOrderItems, changeOrderStatus, cancelOrder, registerPayment,
  addOrderPhoto, moveOrderPhoto, deleteOrderPhoto,
  createPart, updatePart, setPartPhoto, moveStock,
};

export type CommandName = keyof typeof COMMANDS;

type Bound<F> = F extends (db: Database, ctx: Ctx, ...args: infer A) => infer R ? (...args: A) => R : never;
export type Commands = { [K in CommandName]: Bound<(typeof COMMANDS)[K]> };

export interface CommandCall {
  name: CommandName;
  args: unknown[];
}

/** O que vai para o servidor: as chamadas, na ordem, e os IDs gerados por elas. */
export interface CommandBatch {
  calls: CommandCall[];
  ids: ID[];
}

export function isCommandName(name: unknown): name is CommandName {
  return typeof name === "string" && Object.prototype.hasOwnProperty.call(COMMANDS, name);
}

/** Liga as ações a um banco e a uma sessão, anotando cada chamada em `log`. */
export function bindCommands(db: Database, ctx: Ctx, log?: CommandCall[]): Commands {
  const out = {} as Record<CommandName, (...args: unknown[]) => unknown>;
  for (const name of Object.keys(COMMANDS) as CommandName[]) {
    const fn = COMMANDS[name] as (db: Database, ctx: Ctx, ...args: unknown[]) => unknown;
    out[name] = (...args: unknown[]) => {
      // Os argumentos são copiados antes de rodar: o que vai ao servidor é o que foi pedido.
      log?.push({ name, args: structuredClone(args) });
      return fn(db, ctx, ...args);
    };
  }
  return out as unknown as Commands;
}

/** Roda e anota (no navegador): devolve o resultado e o lote para o servidor. */
export function recordCommands<T>(db: Database, ctx: Ctx, fn: (c: Commands) => T): { value: T; batch: CommandBatch } {
  const calls: CommandCall[] = [];
  const ids: ID[] = [];
  const value = withIds(() => { const id = crypto.randomUUID(); ids.push(id); return id; }, () => fn(bindCommands(db, ctx, calls)));
  return { value, batch: { calls, ids } };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Repete um lote (no servidor). Os IDs pedidos pelo navegador só são usados se
 * tiverem o formato certo e ainda não existirem — assim a tela e o servidor
 * ficam com os mesmos IDs sem que um ID antigo possa ser reaproveitado.
 */
export function replayCommands(db: Database, ctx: Ctx, batch: CommandBatch): void {
  if (!batch || !Array.isArray(batch.calls) || !Array.isArray(batch.ids) || batch.calls.length > 50 || batch.ids.length > 500) {
    throw new DomainError("validation", "Pedido inválido.");
  }
  const used = new Set<ID>();
  for (const list of Object.values(db)) if (Array.isArray(list)) for (const x of list as { id?: ID }[]) if (x?.id) used.add(x.id);
  const queue = [...batch.ids];
  const nextId = () => {
    const id = queue.shift();
    if (typeof id === "string" && UUID.test(id) && !used.has(id)) { used.add(id); return id; }
    const fresh = crypto.randomUUID();
    used.add(fresh);
    return fresh;
  };
  const cmds = bindCommands(db, ctx);
  withIds(nextId, () => {
    for (const call of batch.calls) {
      if (!call || !isCommandName(call.name) || !Array.isArray(call.args)) throw new DomainError("validation", "Ação desconhecida.");
      (cmds[call.name] as (...a: unknown[]) => unknown)(...call.args);
    }
  });
}
