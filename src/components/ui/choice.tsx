"use client";

import type { ReactNode } from "react";
import { useId, useState } from "react";
import { addDays, todayISO, weekdayName } from "@/lib/format";
import { cx } from "./primitives";

/**
 * Peças de formulário para quem não tem costume com sistemas (auditoria leiga F2,
 * F3, F6): escolhas em botões grandes no lugar de listas suspensas, dia e horário
 * por atalhos, e opcionais recolhidos em "Mais detalhes". Por baixo são rádios
 * de verdade (setas do teclado trocam, leitor de tela anuncia o grupo).
 */

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export function ChoiceGroup<T extends string>({ label, value, onChange, options, hint, columns, className }: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: ChoiceOption<T>[];
  hint?: string;
  /** Força colunas (ex.: 2 ou 4); padrão: botões lado a lado que quebram linha. */
  columns?: number;
  className?: string;
}) {
  const name = useId();
  return (
    <fieldset className={cx("choice", className)}>
      <legend className="choice-legend">{label}</legend>
      <div className="choice-options" data-cols={columns} style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, display: "grid" } : undefined}>
        {options.map((o) => (
          <label key={o.value} className="choice-option" data-checked={value === o.value || undefined} data-disabled={o.disabled || undefined} data-rich={o.hint || o.icon ? true : undefined}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} disabled={o.disabled} onChange={() => onChange(o.value)} className="sr-only" />
            {o.icon && <span className="choice-icon" aria-hidden>{o.icon}</span>}
            <span className="choice-text">
              <span className="choice-label">{o.label}</span>
              {o.hint && <span className="choice-hint">{o.hint}</span>}
            </span>
          </label>
        ))}
      </div>
      {hint && <p className="choice-help">{hint}</p>}
    </fieldset>
  );
}

/**
 * Dia: Hoje, Amanhã e os próximos dias (ou Hoje, Ontem e os anteriores com
 * `past`, para o que já aconteceu); "Outro dia" abre o calendário.
 */
export function DayPicker({ label, value, onChange, min, days = 6, past = false }: { label: string; value: string; onChange: (iso: string) => void; min?: string; days?: number; past?: boolean }) {
  const today = todayISO();
  const quick = Array.from({ length: days }, (_, i) => addDays(today, past ? -i : i)).filter((d) => !min || d >= min);
  const inQuick = quick.includes(value);
  const [other, setOther] = useState(!inQuick && !!value);
  const id = useId();
  const name = (d: string) => (d === today ? "Hoje" : d === addDays(today, 1) ? "Amanhã" : d === addDays(today, -1) ? "Ontem" : weekdayName(d, true).replace(".", ""));
  return (
    <fieldset className="choice">
      <legend className="choice-legend">{label}</legend>
      <div className="choice-options">
        {quick.map((d) => (
          <label key={d} className="choice-option is-day" data-checked={!other && value === d || undefined}>
            <input type="radio" name={id} checked={!other && value === d} onChange={() => { setOther(false); onChange(d); }} className="sr-only" />
            <span className="choice-text"><span className="choice-label">{name(d)}</span><span className="choice-hint">{d.slice(8, 10)}/{d.slice(5, 7)}</span></span>
          </label>
        ))}
        <label className="choice-option is-day" data-checked={other || undefined}>
          <input type="radio" name={id} checked={other} onChange={() => setOther(true)} className="sr-only" />
          <span className="choice-text"><span className="choice-label">Outro dia</span><span className="choice-hint">Calendário</span></span>
        </label>
      </div>
      {other && (
        <label className="choice-other">
          Qual dia?
          <input type="date" className="choice-input" value={value} min={min} max={past ? today : undefined} onChange={(e) => onChange(e.target.value)} autoFocus />
        </label>
      )}
    </fieldset>
  );
}

const SLOTS = ["07:30", "08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

/** Horário em botões; "Outro horário" para os minutos quebrados. */
export function TimePicker({ label, value, onChange }: { label: string; value: string; onChange: (hhmm: string) => void }) {
  const [other, setOther] = useState(!!value && !SLOTS.includes(value));
  const id = useId();
  return (
    <fieldset className="choice">
      <legend className="choice-legend">{label}</legend>
      <div className="choice-options is-times">
        {SLOTS.map((t) => (
          <label key={t} className="choice-option is-time" data-checked={!other && value === t || undefined}>
            <input type="radio" name={id} checked={!other && value === t} onChange={() => { setOther(false); onChange(t); }} className="sr-only" />
            <span className="choice-label">{t}</span>
          </label>
        ))}
        <label className="choice-option is-time" data-checked={other || undefined}>
          <input type="radio" name={id} checked={other} onChange={() => setOther(true)} className="sr-only" />
          <span className="choice-label">Outro</span>
        </label>
      </div>
      {other && (
        <label className="choice-other">
          Qual horário?
          <input type="time" step={300} className="choice-input" value={value} onChange={(e) => onChange(e.target.value)} autoFocus />
        </label>
      )}
    </fieldset>
  );
}

/** Opcionais recolhidos. */
export function MoreDetails({ summary = "Mais detalhes (opcional)", children, defaultOpen = false }: { summary?: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="more-details" open={defaultOpen || undefined}>
      <summary>{summary}</summary>
      <div className="more-details-body">{children}</div>
    </details>
  );
}
