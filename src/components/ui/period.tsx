"use client";

import { useState } from "react";
import type { ISODate } from "@/domain/types";
import { addDays, addMonths, endOfMonth, startOfMonth, todayISO } from "@/lib/format";
import { Input, Select } from "./primitives";

export type PeriodPreset = "month" | "last_month" | "7" | "30" | "90" | "custom";

export interface Period {
  preset: PeriodPreset;
  from: ISODate;
  to: ISODate;
}

function resolve(preset: PeriodPreset, current: Period | null): Period {
  const today = todayISO();
  switch (preset) {
    case "month":
      return { preset, from: startOfMonth(today), to: endOfMonth(today) };
    case "last_month": {
      const start = addMonths(today, -1);
      return { preset, from: start, to: endOfMonth(start) };
    }
    case "custom":
      return { preset, from: current?.from ?? startOfMonth(today), to: current?.to ?? today };
    default:
      return { preset, from: addDays(today, -(Number(preset) - 1)), to: today };
  }
}

export function usePeriod(initial: PeriodPreset = "month") {
  return useState<Period>(() => resolve(initial, null));
}

export function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select className="w-44" aria-label="Período" value={value.preset} onChange={(e) => onChange(resolve(e.target.value as PeriodPreset, value))}>
        <option value="month">Este mês</option>
        <option value="last_month">Mês passado</option>
        <option value="7">Últimos 7 dias</option>
        <option value="30">Últimos 30 dias</option>
        <option value="90">Últimos 90 dias</option>
        <option value="custom">Período personalizado</option>
      </Select>
      {value.preset === "custom" && (
        <>
          <Input type="date" className="w-40" aria-label="Data inicial" value={value.from} max={value.to} onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })} />
          <span className="text-xs text-muted">até</span>
          <Input type="date" className="w-40" aria-label="Data final" value={value.to} min={value.from} onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })} />
        </>
      )}
    </div>
  );
}
