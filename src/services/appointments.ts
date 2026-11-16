import { z } from "zod";
import type { Appointment, AppointmentStatus, Database, ID } from "@/domain/types";
import { normalizePhone, normalizePlate } from "@/lib/format";
import { assertCan, Ctx, DomainError, findScoped, newId, parse } from "./core";

const appointmentSchema = z.object({
  customerName: z.string().trim().min(2, "Informe o nome do cliente."),
  phone: z
    .string()
    .transform((v) => normalizePhone(v))
    .refine((v): v is string => v !== null, "Telefone inválido. Use DDD + número."),
  plate: z
    .string()
    .transform((v) => (v.trim() === "" ? "" : normalizePlate(v)))
    .refine((v): v is string => v !== null, "Placa inválida. Use ABC-1234 ou ABC1D23."),
  brand: z.string().trim().default(""),
  model: z.string().trim().min(1, "Informe o veículo."),
  service: z.string().trim().min(3, "Informe o serviço pretendido."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data."),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe o horário."),
  mechanicId: z.string().nullable(),
  notes: z.string().trim().default(""),
});

export type AppointmentInput = z.input<typeof appointmentSchema>;

function assertSlotFree(db: Database, ctx: Ctx, data: { date: string; time: string; mechanicId: string | null }, ignoreId?: ID) {
  if (!data.mechanicId) return;
  const clash = db.appointments.some(
    (a) =>
      a.workshopId === ctx.workshopId &&
      a.id !== ignoreId &&
      a.status !== "cancelled" &&
      a.mechanicId === data.mechanicId &&
      a.date === data.date &&
      a.time === data.time,
  );
  if (clash) throw new DomainError("conflict", "Este mecânico já possui um agendamento neste horário.");
}

export function createAppointment(db: Database, ctx: Ctx, input: AppointmentInput): Appointment {
  assertCan(db, ctx, "schedule.manage");
  const data = parse(appointmentSchema, input);
  assertSlotFree(db, ctx, data);
  const appointment: Appointment = {
    id: newId(),
    workshopId: ctx.workshopId,
    status: "scheduled",
    orderId: null,
    ...data,
    phone: data.phone as string,
    plate: data.plate as string,
  };
  db.appointments.push(appointment);
  return appointment;
}

/** Edita ou reagenda. Agendamentos atendidos ou cancelados ficam somente para consulta. */
export function updateAppointment(db: Database, ctx: Ctx, id: ID, input: AppointmentInput): Appointment {
  assertCan(db, ctx, "schedule.manage");
  const appointment = findScoped(db.appointments, ctx, id, "Agendamento não encontrado.");
  if (appointment.orderId || appointment.status === "attended" || appointment.status === "cancelled") {
    throw new DomainError("conflict", "Este agendamento não pode mais ser alterado.");
  }
  const data = parse(appointmentSchema, input);
  assertSlotFree(db, ctx, data, id);
  Object.assign(appointment, data);
  return appointment;
}

export function setAppointmentStatus(db: Database, ctx: Ctx, id: ID, status: AppointmentStatus): void {
  assertCan(db, ctx, "schedule.manage");
  const appointment = findScoped(db.appointments, ctx, id, "Agendamento não encontrado.");
  if (appointment.orderId) {
    throw new DomainError("conflict", "Agendamento já convertido em OS não pode mudar de status.");
  }
  appointment.status = status;
}
