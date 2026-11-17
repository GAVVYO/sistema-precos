"use client";

import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors } from "@dnd-kit/core";
import { AgendaChip, AgendaDay, canReschedule, useReschedule } from "./interactive-agenda";
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/app-state/app-context";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Badge, Button, Card, cx, EmptyState, Field, Input, PageHeader, Segmented, Select, Textarea, Tone } from "@/components/ui/primitives";
import { APPOINTMENT_STATUS_LABELS } from "@/domain/labels";
import type { Appointment, AppointmentStatus, ISODate } from "@/domain/types";
import {
  addDays, addMonths, formatDate, formatOrderNumber, formatPhone, formatPlate, monthName, startOfMonth, startOfWeek, todayISO, weekdayName,
} from "@/lib/format";
import { createAppointment, setAppointmentStatus, updateAppointment } from "@/services/appointments";

const STATUS_TONE: Record<AppointmentStatus, Tone> = { scheduled: "info", confirmed: "success", attended: "neutral", cancelled: "danger" };
const CHIP: Record<AppointmentStatus, string> = {
  scheduled: "border-primary/20 bg-primary-soft",
  confirmed: "border-success/20 bg-success-soft",
  attended: "border-line bg-slate-100 text-muted",
  cancelled: "border-danger/20 bg-danger-soft text-muted line-through",
};

function AppointmentDialog({ appointment, defaultDate, onClose }: { appointment: Appointment | null; defaultDate: ISODate; onClose: () => void }) {
  const { view, act, can, online, mechanics, openNewOrder, openOrder } = useApp();
  const a = appointment;
  const [customerName, setCustomerName] = useState(a?.customerName ?? "");
  const [phone, setPhone] = useState(a ? formatPhone(a.phone) : "");
  const [plate, setPlate] = useState(a?.plate ? formatPlate(a.plate) : "");
  const [brand, setBrand] = useState(a?.brand ?? "");
  const [model, setModel] = useState(a?.model ?? "");
  const [service, setService] = useState(a?.service ?? "");
  const [date, setDate] = useState(a?.date ?? defaultDate);
  const [time, setTime] = useState(a?.time ?? "09:00");
  const [mechanicId, setMechanicId] = useState(a?.mechanicId ?? "");
  const [notes, setNotes] = useState(a?.notes ?? "");
  const [confirmCancel, setConfirmCancel] = useState(false);

  const order = a?.orderId ? view.orders.find((o) => o.id === a.orderId) : null;
  const readOnly = !!a && (a.status === "attended" || a.status === "cancelled" || !!a.orderId);
  const matches =
    !a && customerName.trim().length >= 2
      ? view.customers.filter((c) => c.name.toLowerCase().includes(customerName.trim().toLowerCase()) && c.name !== customerName).slice(0, 4)
      : [];

  const input = { customerName, phone, plate, brand, model, service, date, time, mechanicId: mechanicId || null, notes };
  const save = () => {
    const r = a
      ? act((db, ctx) => updateAppointment(db, ctx, a.id, input), a.date !== date || a.time !== time ? "Agendamento reagendado." : "Agendamento atualizado.")
      : act((db, ctx) => createAppointment(db, ctx, input), "Agendamento criado.");
    if (r.ok) onClose();
  };
  const setStatus = (status: AppointmentStatus, message: string) => {
    if (!a) return;
    const r = act((db, ctx) => setAppointmentStatus(db, ctx, a.id, status), message);
    if (r.ok) onClose();
  };

  return (
    <>
      <Dialog
        title={a ? "Agendamento" : "Novo agendamento"}
        subtitle={a && <Badge tone={STATUS_TONE[a.status]}>{APPOINTMENT_STATUS_LABELS[a.status]}</Badge>}
        onClose={onClose}
        footer={
          <>
            {a && !readOnly && (
              <div className="mr-auto flex gap-2">
                <Button variant="danger" disabled={!online} onClick={() => setConfirmCancel(true)}>Cancelar agendamento</Button>
                {a.status === "scheduled" && <Button disabled={!online} onClick={() => setStatus("confirmed", "Agendamento confirmado.")}>Confirmar</Button>}
              </div>
            )}
            {order && can("os.view") && (
              <Button className="mr-auto" onClick={() => { onClose(); openOrder(order.id); }}>Abrir {formatOrderNumber(order.number)}</Button>
            )}
            <Button onClick={onClose}>Fechar</Button>
            {a && !readOnly && can("os.create") && (
              <Button
                disabled={!online}
                onClick={() => {
                  onClose();
                  openNewOrder({ appointmentId: a.id, customerName: a.customerName, phone: a.phone, plate: a.plate, brand: a.brand, model: a.model, description: a.service, mechanicId: a.mechanicId });
                }}
              >
                Chegou: abrir serviço
              </Button>
            )}
            {!readOnly && <Button variant="primary" disabled={!online} onClick={save}>{a ? "Salvar alterações" : "Criar agendamento"}</Button>}
          </>
        }
      >
        {readOnly && (
          <p className="mb-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-muted">
            {order ? `Este agendamento virou o ${formatOrderNumber(order.number)} e não pode mais ser alterado.` : "Agendamentos atendidos ou cancelados ficam disponíveis apenas para consulta."}
          </p>
        )}
        <fieldset disabled={readOnly} className="grid grid-cols-6 gap-3">
          <div className="relative col-span-4">
            <Field label="Cliente">{(p) => <Input {...p} value={customerName} onChange={(e) => setCustomerName(e.target.value)} autoComplete="off" autoFocus={!a} />}</Field>
            {matches.length > 0 && (
              <ul className="absolute top-full mt-1 right-0 left-0 z-10 rounded-md border border-line bg-surface py-1 shadow-lg" aria-label="Clientes cadastrados">
                {matches.map((c) => {
                  const v = view.vehicles.find((x) => x.customerId === c.id);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="block w-full px-3 py-1.5 text-left text-sm hover:bg-primary-soft"
                        onClick={() => {
                          setCustomerName(c.name);
                          setPhone(formatPhone(c.phone));
                          if (v) { setPlate(formatPlate(v.plate)); setBrand(v.brand); setModel(v.model); }
                        }}
                      >
                        <span className="font-medium">{c.name}</span> <span className="text-xs text-muted">{formatPhone(c.phone)}{v ? ` · ${v.model}` : ""}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <Field label="Telefone" className="col-span-2">{(p) => <Input {...p} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="(85) 98888-7777" />}</Field>
          <Field label="Marca" optional className="col-span-2">{(p) => <Input {...p} value={brand} onChange={(e) => setBrand(e.target.value)} />}</Field>
          <Field label="Modelo do veículo" className="col-span-2">{(p) => <Input {...p} value={model} onChange={(e) => setModel(e.target.value)} />}</Field>
          <Field label="Placa" optional className="col-span-2">{(p) => <Input {...p} value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} maxLength={8} />}</Field>
          <Field label="Serviço pretendido" className="col-span-6">{(p) => <Input {...p} value={service} onChange={(e) => setService(e.target.value)} />}</Field>
          <Field label="Data" className="col-span-2">{(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
          <Field label="Horário" className="col-span-2">{(p) => <Input {...p} type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
          <Field label="Mecânico" optional className="col-span-2">
            {(p) => (
              <Select {...p} value={mechanicId} onChange={(e) => setMechanicId(e.target.value)}>
                <option value="">A definir</option>
                {mechanics.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Observações" optional className="col-span-6">{(p) => <Textarea {...p} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
        </fieldset>
      </Dialog>
      {confirmCancel && a && (
        <ConfirmDialog
          title="Cancelar agendamento"
          message={`Cancelar o agendamento de ${a.customerName} em ${formatDate(a.date)} às ${a.time}? O horário ficará livre.`}
          confirmLabel="Cancelar agendamento"
          danger
          onClose={() => setConfirmCancel(false)}
          onConfirm={() => setStatus("cancelled", "Agendamento cancelado.")}
        />
      )}
    </>
  );
}

function Chip({ a, onOpen, compact }: { a: Appointment; onOpen: (a: Appointment) => void; compact?: boolean }) {
  return <AgendaChip a={a} onOpen={onOpen} compact={compact} appearance={CHIP[a.status]} />;
}

type View = "day" | "week" | "month" | "list";

export function SchedulePage() {
  const { view, online, userOf, can } = useApp();
  const reschedule = useReschedule();
  const [dragging, setDragging] = useState<Appointment | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const params = useSearchParams();
  const today = todayISO();
  const [mode, setMode] = useState<View>("week");
  const [cursor, setCursor] = useState<ISODate>(today);
  const [open, setOpen] = useState<Appointment | "new" | null>(params.has("novo") ? "new" : null);
  const [newDate, setNewDate] = useState<ISODate>(today);

  const byDate = (d: ISODate) => view.appointments.filter((a) => a.date === d).sort((a, b) => a.time.localeCompare(b.time));
  const move = (dir: number) => setCursor(mode === "day" ? addDays(cursor, dir) : mode === "week" ? addDays(cursor, dir * 7) : addMonths(cursor, dir));
  const weekStart = startOfWeek(cursor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const monthStart = startOfMonth(cursor);
  const gridStart = startOfWeek(monthStart);
  const monthDays = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const upcoming = view.appointments
    .filter((a) => a.date >= today && a.status !== "cancelled" && a.status !== "attended")
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const title =
    mode === "day" ? `${weekdayName(cursor)}, ${formatDate(cursor)}` : mode === "week" ? `${formatDate(weekStart)} a ${formatDate(addDays(weekStart, 6))}` : mode === "month" ? monthName(cursor) : "Próximos atendimentos";
  const openNew = (d: ISODate) => { setNewDate(d < today ? today : d); setOpen("new"); };
  const dayList = byDate(cursor);

  return (
    <DndContext sensors={sensors} onDragStart={({ active }) => setDragging(view.appointments.find(a => a.id === active.id) ?? null)} onDragCancel={() => setDragging(null)} onDragEnd={({ active, over }) => {
      setDragging(null);
      const a = view.appointments.find(item => item.id === active.id);
      if (!a || !over || !online || !can("schedule.manage") || !canReschedule(a) || a.date === over.id) return;
      const date = String(over.id);
      reschedule(a, date, a.time);
    }}>
    <div className="module-page module-schedule">
      <PageHeader
        title="Agenda"
        description="Arraste pela alça para mudar o dia. Use o calendário do cartão para ajustar dia e horário."
        actions={<Button variant="primary" icon={<CalendarPlus className="size-4" aria-hidden />} disabled={!online} onClick={() => openNew(mode === "list" ? today : cursor)}>Novo agendamento</Button>}
      />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Segmented label="Visualização" value={mode} onChange={setMode} options={[{ value: "day", label: "Dia" }, { value: "week", label: "Semana" }, { value: "month", label: "Mês" }, { value: "list", label: "Próximos" }]} />
        {mode !== "list" && (
          <div className="flex items-center gap-1">
            <Button size="sm" aria-label="Anterior" onClick={() => move(-1)}><ChevronLeft className="size-4" aria-hidden /></Button>
            <Button size="sm" onClick={() => setCursor(today)}>Hoje</Button>
            <Button size="sm" aria-label="Próximo" onClick={() => move(1)}><ChevronRight className="size-4" aria-hidden /></Button>
          </div>
        )}
        <h2 className="text-sm font-semibold first-letter:uppercase">{title}</h2>
      </div>

      {mode === "day" && (
        <Card>
          {dayList.length === 0 ? (
            <EmptyState icon={<CalendarDays className="size-8" aria-hidden />} title="Nenhum agendamento neste dia" action={<Button disabled={!online} onClick={() => openNew(cursor)}>Novo agendamento</Button>} />
          ) : (
            <table className="data-table">
              <thead><tr><th>Horário</th><th>Cliente</th><th>Telefone</th><th>Veículo</th><th>Serviço</th><th>Mecânico</th><th>Situação</th></tr></thead>
              <tbody>
                {dayList.map((a) => (
                  <tr key={a.id} className="cursor-pointer" onClick={() => setOpen(a)}>
                    <td className="font-semibold tabular-nums">{a.time}</td>
                    <td><button type="button" className="font-medium text-primary hover:underline">{a.customerName}</button></td>
                    <td>{formatPhone(a.phone)}</td>
                    <td>{a.brand} {a.model}{a.plate ? ` · ${formatPlate(a.plate)}` : ""}</td>
                    <td>{a.service}</td>
                    <td>{userOf(a.mechanicId)?.name ?? <span className="text-muted">A definir</span>}</td>
                    <td><Badge tone={STATUS_TONE[a.status]}>{APPOINTMENT_STATUS_LABELS[a.status]}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {mode === "week" && (
        <div className="schedule-week grid grid-cols-7 gap-3">
          {weekDays.map((d) => {
            const list = byDate(d);
            return (
              <AgendaDay key={d} date={d} className={cx("flex min-h-80 flex-col rounded-xl border bg-surface", d === today ? "border-primary" : "border-line")} aria-label={`${weekdayName(d)}, ${formatDate(d)}`}>
                <header className={cx("flex items-baseline justify-between border-b border-line px-2 py-1.5", d === today && "bg-primary-soft")}>
                  <button type="button" className="text-xs font-semibold capitalize hover:underline" onClick={() => { setCursor(d); setMode("day"); }}>
                    {weekdayName(d, true)} {formatDate(d).slice(0, 5)}
                  </button>
                  {d === today && <span className="text-xs font-semibold text-primary uppercase">Hoje</span>}
                </header>
                <div className="flex flex-1 flex-col gap-1 p-1.5">
                  {list.map((a) => <Chip key={a.id} a={a} onOpen={setOpen} />)}
                  {list.length === 0 && <p className="px-1 py-2 text-xs text-muted">Livre</p>}
                </div>
              </AgendaDay>
            );
          })}
        </div>
      )}

      {mode === "month" && (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line bg-slate-50 text-center text-xs font-semibold text-muted">
            {weekDays.map((d) => <div key={d} className="py-1.5 capitalize">{weekdayName(d, true)}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {monthDays.map((d) => {
              const list = byDate(d).filter((a) => a.status !== "cancelled");
              const outside = d.slice(0, 7) !== cursor.slice(0, 7);
              return (
                <AgendaDay key={d} date={d} className={cx("min-h-[88px] border-r border-b border-line p-1", outside && "bg-slate-50")}>
                  <button
                    type="button"
                    onClick={() => { setCursor(d); setMode("day"); }}
                    className={cx("mb-0.5 flex size-6 items-center justify-center rounded-full text-xs font-medium hover:bg-slate-200", d === today && "bg-primary text-primary-fg hover:bg-primary", outside && "text-muted")}
                    aria-label={formatDate(d)}
                  >
                    {Number(d.slice(8))}
                  </button>
                  <div className="space-y-0.5">
                    {list.slice(0, 2).map((a) => <Chip key={a.id} a={a} onOpen={setOpen} compact />)}
                    {list.length > 2 && <button type="button" className="px-1 text-xs font-medium text-primary hover:underline" onClick={() => { setCursor(d); setMode("day"); }}>+{list.length - 2} mais</button>}
                  </div>
                </AgendaDay>
              );
            })}
          </div>
        </Card>
      )}

      {mode === "list" && (
        <Card>
          {upcoming.length === 0 ? (
            <EmptyState icon={<CalendarDays className="size-8" aria-hidden />} title="Nenhum atendimento futuro" description="Crie um agendamento para organizar os próximos dias." />
          ) : (
            <table className="data-table">
              <thead><tr><th>Data</th><th>Horário</th><th>Cliente</th><th>Veículo</th><th>Serviço</th><th>Mecânico</th><th>Situação</th></tr></thead>
              <tbody>
                {upcoming.map((a) => (
                  <tr key={a.id} className="cursor-pointer" onClick={() => setOpen(a)}>
                    <td className="whitespace-nowrap">{a.date === today ? "Hoje" : `${weekdayName(a.date, true)}, ${formatDate(a.date)}`}</td>
                    <td className="font-semibold tabular-nums">{a.time}</td>
                    <td><button type="button" className="font-medium text-primary hover:underline">{a.customerName}</button></td>
                    <td>{a.brand} {a.model}</td>
                    <td>{a.service}</td>
                    <td>{userOf(a.mechanicId)?.name ?? <span className="text-muted">A definir</span>}</td>
                    <td><Badge tone={STATUS_TONE[a.status]}>{APPOINTMENT_STATUS_LABELS[a.status]}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {open && (
        <AppointmentDialog
          key={open === "new" ? "new" : open.id}
          appointment={open === "new" ? null : (view.appointments.find((a) => a.id === open.id) ?? null)}
          defaultDate={newDate}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
    <DragOverlay>{dragging && <div className="w-44 rounded-lg border border-primary bg-surface p-3 text-sm shadow-lg"><strong>{dragging.time} · {dragging.customerName}</strong><p className="mt-1 text-muted">Solte no dia desejado</p></div>}</DragOverlay>
    </DndContext>
  );
}
