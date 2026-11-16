import { z } from "zod";
import type { Customer, Database, ID, Vehicle } from "@/domain/types";
import { normalizePhone, normalizePlate } from "@/lib/format";
import { assertCan, Ctx, DomainError, findScoped, newId, parse } from "./core";

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do cliente."),
  phone: z
    .string()
    .transform((v) => normalizePhone(v))
    .refine((v): v is string => v !== null, "Telefone inválido. Use DDD + número, ex.: (85) 98888-7777."),
});

export const vehicleSchema = z.object({
  plate: z
    .string()
    .transform((v) => normalizePlate(v))
    .refine((v): v is string => v !== null, "Placa inválida. Use o formato ABC-1234 ou ABC1D23."),
  brand: z.string().trim().min(2, "Informe a marca do veículo."),
  model: z.string().trim().min(1, "Informe o modelo do veículo."),
  year: z
    .number()
    .int()
    .min(1950, "Ano inválido.")
    .max(new Date().getFullYear() + 1, "Ano inválido.")
    .nullable(),
  mileage: z.number().int().min(0, "Quilometragem inválida.").nullable(),
});

export type CustomerInput = z.input<typeof customerSchema>;
export type VehicleInput = z.input<typeof vehicleSchema>;

/** Uso interno (sem checagem de permissão): quem chama já autorizou a operação. */
export function insertCustomer(db: Database, ctx: Ctx, input: CustomerInput): Customer {
  const data = parse(customerSchema, input);
  const existing = db.customers.find(
    (c) =>
      c.workshopId === ctx.workshopId &&
      c.phone === data.phone &&
      c.name.toLowerCase() === data.name.toLowerCase(),
  );
  if (existing) return existing;
  const customer: Customer = {
    id: newId(),
    workshopId: ctx.workshopId,
    name: data.name,
    phone: data.phone as string,
    createdAt: ctx.now.toISOString(),
  };
  db.customers.push(customer);
  return customer;
}

/** Reaproveita o veículo pela placa (única por oficina) e atualiza o proprietário atual. */
export function upsertVehicle(db: Database, ctx: Ctx, customerId: ID, input: VehicleInput): Vehicle {
  const data = parse(vehicleSchema, input);
  findScoped(db.customers, ctx, customerId, "Cliente não encontrado.");
  const existing = db.vehicles.find(
    (v) => v.workshopId === ctx.workshopId && v.plate === data.plate,
  );
  if (existing) {
    existing.customerId = customerId;
    existing.brand = data.brand;
    existing.model = data.model;
    if (data.year !== null) existing.year = data.year;
    if (data.mileage !== null) existing.mileage = Math.max(existing.mileage ?? 0, data.mileage);
    return existing;
  }
  const vehicle: Vehicle = {
    id: newId(),
    workshopId: ctx.workshopId,
    customerId,
    plate: data.plate as string,
    brand: data.brand,
    model: data.model,
    year: data.year,
    mileage: data.mileage,
  };
  db.vehicles.push(vehicle);
  return vehicle;
}

const MANAGE = ["os.create", "os.edit", "schedule.manage"] as const;

export function createCustomer(db: Database, ctx: Ctx, input: CustomerInput): Customer {
  assertCan(db, ctx, ...MANAGE);
  return insertCustomer(db, ctx, input);
}

export function updateCustomer(db: Database, ctx: Ctx, id: ID, input: CustomerInput): Customer {
  assertCan(db, ctx, ...MANAGE);
  const customer = findScoped(db.customers, ctx, id, "Cliente não encontrado.");
  const data = parse(customerSchema, input);
  customer.name = data.name;
  customer.phone = data.phone as string;
  return customer;
}

export function saveVehicle(
  db: Database,
  ctx: Ctx,
  customerId: ID,
  input: VehicleInput,
  vehicleId?: ID,
): Vehicle {
  assertCan(db, ctx, ...MANAGE);
  if (!vehicleId) {
    const plate = normalizePlate(input.plate);
    if (plate && db.vehicles.some((v) => v.workshopId === ctx.workshopId && v.plate === plate)) {
      throw new DomainError("conflict", "Já existe um veículo com esta placa nesta oficina.");
    }
    return upsertVehicle(db, ctx, customerId, input);
  }
  const vehicle = findScoped(db.vehicles, ctx, vehicleId, "Veículo não encontrado.");
  const data = parse(vehicleSchema, input);
  findScoped(db.customers, ctx, customerId, "Cliente não encontrado.");
  if (
    db.vehicles.some(
      (v) => v.workshopId === ctx.workshopId && v.plate === data.plate && v.id !== vehicleId,
    )
  ) {
    throw new DomainError("conflict", "Já existe um veículo com esta placa nesta oficina.");
  }
  Object.assign(vehicle, data, { customerId });
  return vehicle;
}
