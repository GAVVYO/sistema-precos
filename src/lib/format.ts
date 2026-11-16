import type { Cents, ISODate, ISODateTime } from "@/domain/types";

export const TIME_ZONE = "America/Fortaleza";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const isoDateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const timeFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatBRL(cents: Cents): string {
  return brl.format(cents / 100);
}

/** `null` = valor ainda não informado (diferente de R$ 0,00). */
export function formatBRLOrPending(cents: Cents | null): string {
  return cents === null ? "A definir" : formatBRL(cents);
}

/** Converte "1.234,56", "150" ou "150,5" em centavos. Retorna null se inválido. */
export function parseBRL(input: string): Cents | null {
  const clean = input.replace(/[R$\s]/g, "");
  if (!clean) return null;
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+([.,]\d{1,2})?$/.test(clean)) return null;
  const normalized = clean.includes(",")
    ? clean.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(clean)
      ? clean.replace(/\./g, "")
      : clean;
  const [intPart, decPart = ""] = normalized.split(".");
  return Number(intPart) * 100 + Number(decPart.padEnd(2, "0"));
}

/** Centavos → texto editável ("1234,56"). */
export function centsToInput(cents: Cents | null): string {
  if (cents === null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function todayISO(now: Date = new Date()): ISODate {
  return isoDateFmt.format(now);
}

/** Data de calendário (Fortaleza) de um instante. */
export function dateOf(instant: ISODateTime): ISODate {
  return isoDateFmt.format(new Date(instant));
}

export function formatDate(value: ISODate | ISODateTime): string {
  const d = value.length > 10 ? dateOf(value) : value;
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export function formatTime(instant: ISODateTime): string {
  return timeFmt.format(new Date(instant));
}

export function formatDateTime(instant: ISODateTime): string {
  return `${formatDate(instant)} ${formatTime(instant)}`;
}

function toUTC(date: ISODate): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = toUTC(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado. */
export function weekday(date: ISODate): number {
  return toUTC(date).getUTCDay();
}

export function startOfWeek(date: ISODate): ISODate {
  return addDays(date, -weekday(date));
}

export function startOfMonth(date: ISODate): ISODate {
  return `${date.slice(0, 7)}-01`;
}

export function endOfMonth(date: ISODate): ISODate {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export function addMonths(date: ISODate, months: number): ISODate {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + months, 1)).toISOString().slice(0, 10);
}

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function weekdayName(date: ISODate, short = false): string {
  const name = WEEKDAYS[weekday(date)];
  return short ? name.slice(0, 3) : name;
}

export function monthName(date: ISODate): string {
  return `${MONTHS[Number(date.slice(5, 7)) - 1]} de ${date.slice(0, 4)}`;
}

/** Instante ISO correspondente a uma data/hora local de Fortaleza (UTC-3, sem horário de verão). */
export function fortalezaInstant(date: ISODate, time = "00:00"): ISODateTime {
  return new Date(`${date}T${time}:00-03:00`).toISOString();
}

export function inRange(date: ISODate, from: ISODate, to: ISODate): boolean {
  return date >= from && date <= to;
}

/* ---------- Telefone brasileiro ---------- */

/** Retorna apenas DDD + número (10 ou 11 dígitos) ou null se inválido. */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  if (digits.length !== 10 && digits.length !== 11) return null;
  if (digits[0] === "0") return null;
  if (digits.length === 11 && digits[2] !== "9") return null;
  return digits;
}

export function formatPhone(input: string): string {
  const d = normalizePhone(input);
  if (!d) return input;
  return d.length === 11
    ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
}

/* ---------- Placa ---------- */

/** Aceita padrão antigo (ABC1234) e Mercosul (ABC1D23). */
export function normalizePlate(input: string): string | null {
  const p = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(p) ? p : null;
}

export function formatPlate(plate: string): string {
  return /^[A-Z]{3}\d{4}$/.test(plate) ? `${plate.slice(0, 3)}-${plate.slice(3)}` : plate;
}

export function formatOrderNumber(n: number): string {
  return `OS-${String(n).padStart(4, "0")}`;
}
