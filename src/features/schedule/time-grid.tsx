"use client";

import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { GripVertical, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/app-state/app-context";
import { cx } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { APPOINTMENT_STATUS_LABELS } from "@/domain/labels";
import type { Appointment, AppointmentStatus, ID, ISODate } from "@/domain/types";
import { formatDate, todayISO, weekdayName } from "@/lib/format";
import { updateAppointment } from "@/services/appointments";

/**
 * Grade de horários no estilo do Calendário do macOS / Google Agenda.
 * Arrastar um agendamento remarca (dia/horário) ou troca o mecânico; clicar
 * abre o formulário, que é a alternativa sem arrasto (WCAG 2.5.7).
 */

const FIRST_HOUR = 7;
const LAST_HOUR = 19; // exclusivo
export const SLOTS: string[] = Array.from({ length: (LAST_HOUR - FIRST_HOUR) * 2 }, (_, i) => {
  const h = FIRST_HOUR + Math.floor(i / 2);
  return `${String(h).padStart(2, "0")}:${i % 2 ? "30" : "00"}`;
});

/** Encaixa um horário qualquer na meia hora da grade (fora do expediente vai para a primeira/última linha). */
function slotOf(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const idx = Math.max(0, Math.min(SLOTS.length - 1, (h - FIRST_HOUR) * 2 + (m >= 30 ? 1 : 0)));
  return SLOTS[idx];
}

function nowSlot(): string {
  const d = new Date();
  return slotOf(`${d.getHours()}:${d.getMinutes()}`);
}

const BLOCK: Record<AppointmentStatus, string> = {
  scheduled: "border-l-primary bg-primary-soft text-ink",
  confirmed: "border-l-emerald-600 bg-success-soft text-ink",
  attended: "border-l-slate-400 bg-slate-100 text-muted",
  cancelled: "border-l-red-400 bg-danger-soft text-muted line-through",
};

export interface GridColumn {
  id: string;
  date: ISODate;
  mechanicId?: ID | null;
  label: string;
  sublabel?: string;
  highlight?: boolean;
}

function canMove(a: Appointment) {
  return !a.orderId && (a.status === "scheduled" || a.status === "confirmed");
}

function Block({ a, draggable, overlay, onOpen }: { a: Appointment; draggable: boolean; overlay?: boolean; onOpen: (a: Appointment) => void }) {
  const { userOf } = useApp();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: a.id, disabled: !draggable || overlay });
  const who = a.customerName.split(" ").slice(0, 2).join(" ");
  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      className={cx(
        "group/block flex items-stretch rounded border-l-[3px] text-xs",
        BLOCK[a.status],
        isDragging && !overlay && "opacity-30",
        overlay && "w-52 shadow-lg ring-1 ring-primary/30",
      )}
    >
      {draggable && (
        <button
          type="button"
          className="flex cursor-grab touch-none items-center px-0.5 text-slate-400 opacity-60 hover:text-ink group-hover/block:opacity-100 active:cursor-grabbing"
          aria-label={`Arrastar agendamento de ${who} às ${a.time} para outro horário`}
          {...listeners}
          {...attributes}
        >
          <GripVertical className="size-3.5" aria-hidden />
        </button>
      )}
      <button
        type="button"
        onClick={() => onOpen(a)}
        className={cx("min-w-0 flex-1 py-1 pr-1.5 text-left", !draggable && "pl-1.5")}
        title={`${a.time} · ${a.customerName} · ${a.service} · ${APPOINTMENT_STATUS_LABELS[a.status]}`}
      >
        <span className="block truncate">
          <span className="font-semibold tabular-nums">{a.time}</span> <span className="font-medium">{who}</span>
        </span>
        <span className="block truncate text-[11px] opacity-80">
          {a.model} · {a.service}
          {a.mechanicId && ` · ${userOf(a.mechanicId)?.name.split(" ")[0]}`}
        </span>
      </button>
    </div>
  );
}

function Cell({
  col,
  slot,
  items,
  past,
  canDrop,
  onOpen,
  onCreate,
  draggableIds,
}: {
  col: GridColumn;
  slot: string;
  items: Appointment[];
  past: boolean;
  canDrop: boolean;
  onOpen: (a: Appointment) => void;
  onCreate?: (date: ISODate, time: string, mechanicId?: ID | null) => void;
  draggableIds: Set<ID>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${col.id}|${slot}`, data: { col, slot }, disabled: past || !canDrop });
  const hour = slot.endsWith(":00");
  return (
    <div
      ref={setNodeRef}
      className={cx(
        "group/cell relative min-h-10 border-l border-line p-0.5",
        hour ? "border-t border-t-line" : "border-t border-t-line/50 border-dashed",
        past && "bg-slate-50/70",
        col.highlight && !past && "bg-primary-soft/40",
        isOver && "bg-primary-soft ring-2 ring-primary/40 ring-inset",
      )}
    >
      <div className="flex flex-col gap-0.5">
        {items.map((a) => (
          <Block key={a.id} a={a} draggable={draggableIds.has(a.id)} onOpen={onOpen} />
        ))}
      </div>
      {onCreate && !past && items.length === 0 && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={() => onCreate(col.date, slot, col.mechanicId)}
          className="absolute inset-0.5 flex items-center justify-center rounded text-[11px] text-primary opacity-0 hover:bg-primary-soft hover:opacity-100"
        >
          <Plus className="mr-0.5 size-3" /> {slot}
        </button>
      )}
    </div>
  );
}

export function TimeGrid({
  columns,
  appointments,
  onOpen,
  onCreate,
}: {
  columns: GridColumn[];
  appointments: Appointment[];
  onOpen: (a: Appointment) => void;
  onCreate?: (date: ISODate, time: string, mechanicId?: ID | null) => void;
}) {
  const { online, can, act } = useApp();
  const today = todayISO();
  const current = nowSlot();
  const [dragging, setDragging] = useState<Appointment | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));
  const editable = online && can("schedule.manage");
  const draggableIds = new Set(editable ? appointments.filter(canMove).map((a) => a.id) : []);
  const mechanicColumns = columns.some((c) => c.mechanicId !== undefined);

  // Abre a grade perto do horário atual (ou das 8h), como o Calendário faz.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const target = el.querySelector<HTMLElement>(`[data-slot="${current < "08:00" ? "08:00" : current}"]`);
    if (target) el.scrollTop = Math.max(0, target.offsetTop - 80);
    // apenas ao montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inCell = (col: GridColumn, slot: string) =>
    appointments
      .filter((a) => a.date === col.date && slotOf(a.time) === slot && (!mechanicColumns || (a.mechanicId ?? null) === (col.mechanicId ?? null)))
      .sort((a, b) => a.time.localeCompare(b.time));

  const isPast = (date: ISODate, slot: string) => date < today || (date === today && slot < current);

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const a = appointments.find((x) => x.id === e.active.id);
    const data = e.over?.data.current as { col: GridColumn; slot: string } | undefined;
    if (!a || !data) return;
    const { col, slot } = data;
    const mechanicId = col.mechanicId !== undefined ? col.mechanicId : a.mechanicId;
    // Soltar na mesma meia hora mantém o horário exato (ex.: 14:15).
    const time = slotOf(a.time) === slot && a.date === col.date ? a.time : slot;
    if (a.date === col.date && a.time === time && a.mechanicId === mechanicId) return;
    const mech = col.mechanicId !== undefined ? (mechanicId ? ` com ${col.label}` : " sem mecânico") : "";
    const input = (date: ISODate, t: string, m: ID | null) => ({
      customerName: a.customerName, phone: a.phone, plate: a.plate, brand: a.brand, model: a.model,
      service: a.service, date, time: t, mechanicId: m, notes: a.notes,
    });
    const res = act((d, c) => updateAppointment(d, c, a.id, input(col.date, time, mechanicId)));
    if (!res.ok) return;
    toast("success", `Agendamento de ${a.customerName.split(" ")[0]} movido para ${weekdayName(col.date, true)}, ${formatDate(col.date).slice(0, 5)} às ${time}${mech}.`, {
      label: "Desfazer",
      run: () => act((d, c) => updateAppointment(d, c, a.id, input(a.date, a.time, a.mechanicId)), "Remarcação desfeita."),
    });
  };

  const template = `56px repeat(${columns.length}, minmax(120px, 1fr))`;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e: DragStartEvent) => setDragging(appointments.find((a) => a.id === e.active.id) ?? null)}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div ref={scroller} className="max-h-[calc(100vh-215px)] overflow-auto select-none rounded-md border border-line bg-surface">
        <div className="grid min-w-fit" style={{ gridTemplateColumns: template }}>
          {/* Cabeçalho fixo */}
          <div className="sticky top-0 left-0 z-20 border-b border-line bg-surface" />
          {columns.map((c) => (
            <div key={c.id} className={cx("sticky top-0 z-10 border-b border-l border-line px-2 py-1.5", c.highlight ? "bg-primary-soft" : "bg-surface")}>
              <p className={cx("truncate text-xs font-semibold first-letter:uppercase", c.highlight && "text-primary")}>{c.label}</p>
              {c.sublabel && <p className="truncate text-[11px] text-muted">{c.sublabel}</p>}
            </div>
          ))}

          {SLOTS.map((slot) => (
            <div key={slot} className="contents">
              <div
                data-slot={slot}
                className={cx(
                  "sticky left-0 z-10 border-t border-line bg-surface pr-2 text-right text-[11px] tabular-nums",
                  slot.endsWith(":00") ? "text-muted" : "text-transparent",
                  slot === current && "font-semibold text-danger",
                )}
              >
                <span className="relative -top-2 bg-surface px-0.5">{slot === current ? slot : slot.endsWith(":00") ? slot : ""}</span>
              </div>
              {columns.map((c) => (
                <Cell
                  key={c.id}
                  col={c}
                  slot={slot}
                  items={inCell(c, slot)}
                  past={isPast(c.date, slot)}
                  canDrop={editable}
                  onOpen={onOpen}
                  onCreate={editable ? onCreate : undefined}
                  draggableIds={draggableIds}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>{dragging && <Block a={dragging} draggable overlay onOpen={() => {}} />}</DragOverlay>
    </DndContext>
  );
}
