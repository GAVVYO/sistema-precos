"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CalendarClock, GripVertical } from "lucide-react";
import { ComponentProps, useState } from "react";
import { useApp } from "@/app-state/app-context";
import { Dialog } from "@/components/ui/dialog";
import { Button, cx, Field, Input } from "@/components/ui/primitives";
import type { Appointment } from "@/domain/types";
import { formatDate } from "@/lib/format";
import { updateAppointment } from "@/services/appointments";

export function canReschedule(a: Appointment) {
  return !a.orderId && (a.status === "scheduled" || a.status === "confirmed");
}

export function AgendaDay({ date, className, ...props }: ComponentProps<"div"> & { date: string }) {
  const { online, can } = useApp();
  const { setNodeRef, isOver } = useDroppable({ id: date, disabled: !online || !can("schedule.manage") });
  return <div ref={setNodeRef} className={cx(className, "transition-colors", isOver && "bg-primary-soft outline-2 outline-primary outline-offset-2")} {...props} />;
}

export function AgendaChip({ a, onOpen, compact, appearance }: { a: Appointment; onOpen: (a: Appointment) => void; compact?: boolean; appearance: string }) {
  const { online, can, act } = useApp();
  const editable = online && can("schedule.manage") && canReschedule(a);
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: a.id, disabled: !editable });
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(a.date);
  const [time, setTime] = useState(a.time);
  return <>
    <article ref={setNodeRef} className={cx("appointment-chip rounded-lg border text-sm", appearance, isDragging && "opacity-40")}>
      <div className="flex items-center gap-1 px-2 pt-1">
        <span className="mr-auto font-bold tabular-nums">{a.time}</span>
        {editable && <>
          <button type="button" className="flex size-8 shrink-0 items-center justify-center rounded hover:bg-surface cursor-grab touch-none active:cursor-grabbing" aria-label={`Arrastar agendamento de ${a.customerName}`} {...attributes} {...listeners}><GripVertical size={16} aria-hidden /></button>
          <button type="button" className="flex size-8 shrink-0 items-center justify-center rounded hover:bg-surface" aria-label={`Reagendar ${a.customerName}`} onClick={() => { setDate(a.date); setTime(a.time); setEditing(true); }}><CalendarClock size={16} aria-hidden /></button>
        </>}
      </div>
      <button type="button" onClick={() => onOpen(a)} className="block w-full px-2.5 pb-3 pt-1 text-left" title="Abrir agendamento">
        <span className="font-semibold">{a.customerName.split(" ").slice(0, 2).join(" ")}</span>
        {!compact && <span className="mt-1 block text-xs leading-relaxed">{a.model} · {a.service}</span>}
      </button>
    </article>
    {editing && <Dialog title="Reagendar" subtitle={`${a.customerName} · ${a.model}`} size="sm" onClose={() => setEditing(false)} footer={<><Button onClick={() => setEditing(false)}>Voltar</Button><Button variant="primary" disabled={!editable || !date || !time} onClick={() => {
      const r = act((db, ctx) => updateAppointment(db, ctx, a.id, { ...a, date, time }), `Agendamento alterado para ${formatDate(date)} às ${time}.`);
      if (r.ok) setEditing(false);
    }}>Salvar horário</Button></>}>
      <div className="grid grid-cols-2 gap-4"><Field label="Dia">{p => <Input {...p} type="date" value={date} onChange={e => setDate(e.target.value)} />}</Field><Field label="Horário">{p => <Input {...p} type="time" value={time} onChange={e => setTime(e.target.value)} />}</Field></div>
      <p className="mt-4 text-sm text-muted">Cliente, serviço e responsável permanecem os mesmos.</p>
    </Dialog>}
  </>;
}
