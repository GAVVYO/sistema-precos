"use client";

import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors } from "@dnd-kit/core";
import { AgendaChip, AgendaDay, canReschedule, useReschedule } from "./interactive-agenda";
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/app-state/app-context";
import { Pager, usePager } from "@/components/ui/pager";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Badge, Button, Card, cx, EmptyState, Field, Input, PageHeader, Textarea, Tone } from "@/components/ui/primitives";
import { APPOINTMENT_STATUS_LABELS } from "@/domain/labels";
import type { Appointment, AppointmentStatus, ISODate } from "@/domain/types";
import {
  addDays, addMonths, formatDate, formatOrderNumber, formatPhone, formatPlate, monthName, startOfMonth, startOfWeek, todayISO, weekdayName,
} from "@/lib/format";
import { ChoiceGroup, DayPicker, MoreDetails, TimePicker } from "@/components/ui/choice";

import { maskPhone, maskPlate } from "@/lib/masks";
import { MiniPlate } from "@/features/dashboard/yard";

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
      ? act((c) => c.updateAppointment(a.id, input), a.date !== date || a.time !== time ? "Agendamento reagendado." : "Agendamento atualizado.")
      : act((c) => c.createAppointment(input), "Agendamento criado.");
    if (r.ok) onClose();
  };
  const setStatus = (status: AppointmentStatus, message: string) => {
    if (!a) return;
    const r = act((c) => c.setAppointmentStatus(a.id, status), message);
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
            <Field label="Nome do cliente">{(p) => <Input {...p} value={customerName} onChange={(e) => setCustomerName(e.target.value)} autoComplete="off" autoFocus={!a} />}</Field>
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
          <Field label="Telefone (WhatsApp)" className="col-span-2">{(p) => <Input {...p} value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} inputMode="tel" />}</Field>
          <Field label="Qual carro? (modelo)" className="col-span-6">{(p) => <Input {...p} value={model} onChange={(e) => setModel(e.target.value)} />}</Field>
          <div className="col-span-6 grid gap-2">
            <Field label="O que vai fazer?">{(p) => <Input {...p} value={service} onChange={(e) => setService(e.target.value)} />}</Field>
            <div className="choice-chips" role="group" aria-label="Sugestões de serviço">
              {QUICK_SERVICES.map((s) => (
                <button key={s} type="button" className="choice-chip" aria-pressed={service === s} onClick={() => setService(s)}>{s}</button>
              ))}
            </div>
          </div>
          <div className="col-span-6"><DayPicker label="Que dia?" value={date} onChange={setDate} min={a ? undefined : todayISO()} /></div>
          <div className="col-span-6"><TimePicker label="Que horas?" value={time} onChange={setTime} /></div>
          <div className="col-span-6">
            <MoreDetails summary="Mais detalhes (opcional): mecânico, marca, placa e observações">
              <ChoiceGroup label="Quem vai atender?" value={mechanicId} onChange={setMechanicId} options={[{ value: "", label: "Ainda não sei" }, ...mechanics.map((m) => ({ value: m.id, label: m.name.split(" ").slice(0, 2).join(" ") }))]} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Marca">{(p) => <Input {...p} value={brand} onChange={(e) => setBrand(e.target.value)} />}</Field>
                <Field label="Placa">{(p) => <Input {...p} value={plate} onChange={(e) => setPlate(maskPlate(e.target.value))} maxLength={8} />}</Field>
              </div>
              <Field label="Observações">{(p) => <Textarea {...p} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
            </MoreDetails>
          </div>
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
const QUICK_SERVICES = ["Troca de óleo", "Revisão", "Freios", "Alinhamento", "Diagnóstico elétrico", "Suspensão"];

export function SchedulePage() {
  const { view, online, userOf, can } = useApp();
  const reschedule = useReschedule();
  const [dragging, setDragging] = useState<Appointment | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const params = useSearchParams();
  const today = todayISO();
  // Abre no Dia (auditoria leiga G6): lista como o Hoje; semana e mês continuam como opção.
  const [mode, setMode] = useState<View>("day");
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
  const upcomingPager = usePager(upcoming, 20);
  const title =
    mode === "day" ? `${weekdayName(cursor)}, ${formatDate(cursor)}` : mode === "week" ? `${formatDate(weekStart)} a ${formatDate(addDays(weekStart, 6))}` : mode === "month" ? monthName(cursor) : "Próximos atendimentos";
  const openNew = (d: ISODate) => { setNewDate(d < today ? today : d); setOpen("new"); };

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
        description="Quem vem em cada dia. Quando o cliente chegar, toque em Chegou: abrir serviço."
        actions={<Button variant="primary" icon={<CalendarPlus className="size-4" aria-hidden />} disabled={!online} onClick={() => openNew(mode === "list" ? today : cursor)}>Novo agendamento</Button>}
      />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Ver a agenda por" className="fin-areas !mb-0">
          {([["day", "Dia"], ["week", "Semana"], ["month", "Mês"], ["list", "Próximos"]] as const).map(([v, l]) => (
            <button key={v} type="button" role="tab" aria-selected={mode === v} onClick={() => setMode(v)}>{l}</button>
          ))}
        </div>
        {mode !== "list" && mode !== "day" && (
          <div className="flex items-center gap-1">
            <Button size="sm" aria-label="Anterior" onClick={() => move(-1)}><ChevronLeft className="size-4" aria-hidden /></Button>
            <Button size="sm" onClick={() => setCursor(today)}>Hoje</Button>
            <Button size="sm" aria-label="Próximo" onClick={() => move(1)}><ChevronRight className="size-4" aria-hidden /></Button>
          </div>
        )}
        {mode !== "day" && <h2 className="text-sm font-semibold first-letter:uppercase">{title}</h2>}
      </div>

      {mode === "day" && <DayView day={cursor} today={today} onPick={setCursor} onOpen={setOpen} onNew={() => openNew(cursor)} />}

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
            <EmptyState icon={<CalendarDays className="size-8" aria-hidden />} title="Nenhum cliente marcado para os próximos dias" description="Quando um cliente ligar para marcar, registre aqui." action={<Button variant="primary" disabled={!online} onClick={() => openNew(today)}>Novo agendamento</Button>} />
          ) : (
            <>
            <table className="data-table">
              <thead><tr><th>Data</th><th>Horário</th><th>Cliente</th><th>Veículo</th><th>Serviço</th><th>Mecânico</th><th>Situação</th></tr></thead>
              <tbody>
                {upcomingPager.items.map((a) => (
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
              <Pager pager={upcomingPager} label="próximos agendamentos" noun="agendamentos" />
            </>
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

/**
 * Agenda no Dia (decisão 90): faixa da semana para pular de dia, setas de dia
 * anterior e próximo e, abaixo, cada horário como cartão numa linha do tempo
 * (como o Pátio), com a próxima ação: Confirmar ou Chegou: abrir serviço.
 */
function DayView({ day, today, onPick, onOpen, onNew }: { day: ISODate; today: ISODate; onPick: (d: ISODate) => void; onOpen: (a: Appointment) => void; onNew: () => void }) {
  const { view, online, can, userOf, act, openNewOrder } = useApp();
  const week = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(day), i));
  const count = (d: ISODate) => view.appointments.filter((a) => a.date === d && a.status !== "cancelled").length;
  const list = view.appointments.filter((a) => a.date === day).sort((a, b) => a.time.localeCompare(b.time));
  const rel = day === today ? "Hoje" : day === addDays(today, 1) ? "Amanhã" : day === addDays(today, -1) ? "Ontem" : null;
  const title = `${weekdayName(day).replace(/^./, (c) => c.toUpperCase())}, ${Number(day.slice(8))} de ${monthName(day).split(" ")[0]}`;
  const active = list.filter((a) => a.status !== "cancelled");

  return (
    <div className="ag">
      <div className="ag-nav">
        <button type="button" className="ag-arrow" aria-label="Dia anterior" onClick={() => onPick(addDays(day, -1))}><ChevronLeft aria-hidden /></button>
        <div className="ag-title">
          <h2>{rel ? <>{rel}<span>{title}</span></> : title}</h2>
          {day !== today && <button type="button" className="cash-link" onClick={() => onPick(today)}>Voltar para hoje</button>}
        </div>
        <button type="button" className="ag-arrow" aria-label="Próximo dia" onClick={() => onPick(addDays(day, 1))}><ChevronRight aria-hidden /></button>
      </div>

      <div className="ag-week" role="group" aria-label="Dias da semana">
        {week.map((d) => {
          const n = count(d);
          return (
            <button key={d} type="button" className="ag-day" aria-pressed={d === day} data-today={d === today || undefined} onClick={() => onPick(d)}>
              <small>{weekdayName(d, true)}</small>
              <strong>{Number(d.slice(8))}</strong>
              <span className="ag-dots" aria-hidden>{Array.from({ length: Math.min(n, 4) }, (_, i) => <i key={i} />)}</span>
              <span className="sr-only">{n ? `${n} ${n === 1 ? "cliente" : "clientes"}` : "livre"}</span>
            </button>
          );
        })}
      </div>

      <p className="ag-say">{active.length === 0 ? "Ninguém marcado neste dia." : `${active.length} ${active.length === 1 ? "cliente marcado" : "clientes marcados"}.`}</p>

      {list.length === 0 ? (
        <div className="ag-empty">
          <CalendarDays aria-hidden />
          <p>Quando um cliente ligar para marcar, registre aqui.</p>
          {can("schedule.manage") && <Button variant="primary" disabled={!online} onClick={onNew}>Marcar cliente neste dia</Button>}
        </div>
      ) : (
        <ol key={day} className="ag-rail">
          {list.map((a, i) => {
            const open = a.status === "scheduled" || a.status === "confirmed";
            return (
              <li key={a.id} className="ag-item" data-status={a.status} style={{ "--i": i } as React.CSSProperties}>
                <span className="ag-time">{a.time}</span>
                <div className="ag-card">
                  <button type="button" className="ag-open" onClick={() => onOpen(a)}>
                    <span className="ag-main">
                      <b>{a.customerName}</b>
                      <small>{[`${a.brand} ${a.model}`.trim(), a.service].filter(Boolean).join(" · ")}</small>
                      <small>{userOf(a.mechanicId) ? `Com ${userOf(a.mechanicId)!.name.split(" ")[0]}` : "Mecânico a definir"} · {formatPhone(a.phone)}</small>
                    </span>
                    {a.plate && <MiniPlate plate={a.plate} />}
                  </button>
                  <div className="ag-actions">
                    <Badge tone={STATUS_TONE[a.status]}>{APPOINTMENT_STATUS_LABELS[a.status]}</Badge>
                    {a.status === "scheduled" && can("schedule.manage") && (
                      <Button size="sm" disabled={!online} onClick={() => act((c) => c.setAppointmentStatus(a.id, "confirmed"), `${a.customerName.split(" ")[0]} confirmado.`)}>Confirmar</Button>
                    )}
                    {open && day <= today && can("os.create") && (
                      <Button size="sm" variant="primary" disabled={!online} onClick={() => openNewOrder({ appointmentId: a.id, customerName: a.customerName, phone: a.phone, plate: a.plate, brand: a.brand, model: a.model, description: a.service, mechanicId: a.mechanicId })}>Chegou: abrir serviço</Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

