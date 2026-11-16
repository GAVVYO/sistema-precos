import type { ReactNode } from "react";

/** Indicador compacto: a cor identifica o card, não substitui seu rótulo. */
export function MetricCard({ label, value, note, footer, appearance, icon, onSelect, selected }: {
  label: string;
  value: ReactNode;
  note?: string;
  footer: ReactNode;
  appearance: "waiting" | "active" | "done" | "neutral";
  icon?: ReactNode;
  onSelect?: () => void;
  selected?: boolean;
}) {
  const content = <>
      <span className="metric-card-heading">
        <span className="metric-card-label">{label}</span>
        {icon && <span className="metric-card-icon" aria-hidden="true">{icon}</span>}
      </span>
      <span className="metric-card-reading">
        <span className="metric-card-value">{value}</span>
        {note && <span className="metric-card-note">{note}</span>}
      </span>
      <span className="metric-card-footer block">{footer}</span>
    </>;
  return onSelect ? <button type="button" className="metric-card metric-select text-left" data-appearance={appearance} aria-label={`Filtrar: ${label}`} aria-pressed={selected} onClick={onSelect}>{content}</button> : <section className="metric-card" data-appearance={appearance} aria-label={label}>{content}</section>;
}
