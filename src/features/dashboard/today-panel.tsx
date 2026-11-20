"use client";

import { CalendarDays, CalendarPlus, CheckCircle2, CircleDollarSign, DoorOpen, Phone } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/app-state/app-context";
import { CountUp } from "@/components/ui/count-up";
import { GuidedTour, IllusTap } from "@/components/ui/guided-tour";
import { Badge, Button, EmptyState } from "@/components/ui/primitives";
import type { Appointment, FinancialTransaction } from "@/domain/types";
import { SettleDialog } from "@/features/finance/finance-page";
import { PaymentDialog } from "@/features/orders/order-dialogs";
import { vehicleLabel } from "@/features/orders/shared";
import { addDays, formatBRL, formatDate, formatOrderNumber, formatPhone, formatPlate, todayISO } from "@/lib/format";
import { listReceivables } from "@/services/finance";
import { vtName } from "@/lib/view-transition";
import { StockLine } from "./yard";

const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

function sinceLabel(date: string): string {
  const today = todayISO();
  if (date === today) return "Pronto hoje";
  if (date === addDays(today, -1)) return "Pronto ontem";
  return `Pronto desde ${formatDate(date).slice(0, 5)}`;
}

/** Quem chega hoje e a que horas. Só reorganiza a agenda existente. */
function Arrivals({ compact = false }: { compact?: boolean }) {
  const { view, can, settings, online, openNewOrder, openOrder } = useApp();
  const today = todayISO();
  const list = view.appointments.filter((a) => a.date === today && a.status !== "cancelled").sort((a, b) => a.time.localeCompare(b.time));
  const canOpen = can("os.create") && settings.activeModules.includes("orders");
  const now = nowHHMM();
  const waiting = list.filter((a) => a.status !== "attended");
  const next = waiting.find((a) => a.time >= now);

  const arrived = (a: Appointment) =>
    openNewOrder({ appointmentId: a.id, customerName: a.customerName, phone: a.phone, plate: a.plate, brand: a.brand, model: a.model, description: a.service, mechanicId: a.mechanicId });

  return (
    <section className={compact ? "today-card is-rail" : "today-card"} aria-labelledby="today-arrivals">
      <header className="today-head">
        <span className="today-icon"><CalendarDays aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h2 id="today-arrivals" className="today-title">Quem chega hoje</h2>
          <p className="today-sub">{waiting.length === 0 ? "Ninguém mais esperado hoje" : `${waiting.length} ${waiting.length === 1 ? "cliente esperado" : "clientes esperados"}`}</p>
        </div>
        <Link href="/agenda" className="today-link">Ver agenda</Link>
      </header>
      {list.length === 0 && compact ? (
        <p className="rail-empty">Ninguém marcado. <Link href="/agenda?novo=1" className="today-link">Agendar</Link></p>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="size-7" aria-hidden />}
          title="Ninguém marcado para hoje"
          description="Quando um cliente ligar para marcar, registre na Agenda."
          action={<Link href="/agenda?novo=1" className="ui-button inline-flex h-10 items-center gap-1.5 rounded-md border border-line bg-surface px-4 text-sm font-semibold"><CalendarPlus className="size-4" aria-hidden />Novo agendamento</Link>}
        />
      ) : (
        <ul className="today-list">
          {list.map((a) => {
            const done = a.status === "attended";
            const late = !done && a.time < now;
            const order = a.orderId ? view.orders.find((o) => o.id === a.orderId) : undefined;
            return (
              <li key={a.id} className="today-row" data-done={done || undefined}>
                <span className="today-time">{a.time}</span>
                <span className="today-who">
                  <strong>{a.customerName}</strong>
                  <span className="today-meta">{a.brand} {a.model} {a.plate && <span className="vehicle-plate">{formatPlate(a.plate)}</span>}</span>
                  <span className="today-meta">{a.service}</span>
                </span>
                <span className="today-state">
                  {done ? <Badge tone="success">Já chegou</Badge> : late ? <Badge tone="warning">Atrasado</Badge> : a === next ? <Badge tone="info">Próximo</Badge> : null}
                </span>
                <span className="today-action">
                  {done ? (
                    order && <Button onClick={() => openOrder(order.id)}>Ver {formatOrderNumber(order.number)}</Button>
                  ) : canOpen ? (
                    <Button data-tour="arrived" variant="primary" icon={<DoorOpen className="size-4" aria-hidden />} disabled={!online} onClick={() => arrived(a)}>Chegou: abrir serviço</Button>
                  ) : (
                    <a className="today-phone" href={`tel:${a.phone}`}><Phone className="size-4" aria-hidden />{formatPhone(a.phone)}</a>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Quem falta pagar: carros prontos ainda não pagos (e entradas a receber, para o financeiro). */
function Payments() {
  const { view, can, online, customerOf, vehicleOf, openOrder } = useApp();
  const [payOrder, setPayOrder] = useState<string | null>(null);
  const [settle, setSettle] = useState<FinancialTransaction | null>(null);
  const canPay = can("finance.payment");
  const list = listReceivables(view).filter((r) => r.order || can("finance.view"));
  const total = list.reduce((s, r) => s + r.amountCents, 0);

  return (
    <section className="today-card" aria-labelledby="today-payments">
      <header className="today-head">
        <span className="today-icon is-money"><CircleDollarSign aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h2 id="today-payments" className="today-title">Quem falta pagar</h2>
          <p className="today-sub">{list.length === 0 ? "Nenhum valor em aberto" : <>{list.length} {list.length === 1 ? "valor em aberto" : "valores em aberto"} · <CountUp value={total} format={formatBRL} /></>}</p>
        </div>
        {can("finance.view") && <Link href="/financeiro" className="today-link">Ver financeiro</Link>}
      </header>
      {list.length === 0 ? (
        <EmptyState icon={<CheckCircle2 className="size-7" aria-hidden />} title="Ninguém devendo" description="Todos os carros prontos já foram pagos." />
      ) : (
        <ul className="today-list">
          {list.map((r) => {
            const v = r.order ? vehicleOf(r.order.vehicleId) : undefined;
            const name = customerOf(r.customerId)?.name ?? "Cliente";
            return (
              <li key={r.key} className="today-row" style={{ ["--vt" as string]: vtName("pay", r.key) }}>
                <span className="today-who">
                  {r.order ? (
                    <button type="button" className="today-name-link" onClick={() => openOrder(r.order!.id)}>{name}</button>
                  ) : (
                    <strong>{r.customerId ? name : r.transaction?.description}</strong>
                  )}
                  <span className="today-meta">
                    {r.order ? <>{formatOrderNumber(r.order.number)} · {vehicleLabel(v)} {v && <span className="vehicle-plate">{formatPlate(v.plate)}</span>}</> : r.customerId ? r.transaction?.description : "Entrada sem serviço"}
                  </span>
                  <span className="today-meta">{r.order ? sinceLabel(r.since) : `Desde ${formatDate(r.since).slice(0, 5)}`}</span>
                </span>
                <span className="today-value">{formatBRL(r.amountCents)}</span>
                <span className="today-action">
                  {canPay ? (
                    <Button data-tour="receive" variant="primary" icon={<CircleDollarSign className="size-4" aria-hidden />} disabled={!online} onClick={() => (r.order ? setPayOrder(r.order.id) : setSettle(r.transaction))}>Receber</Button>
                  ) : (
                    <span className="today-hint">Quem recebe: dono ou financeiro</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {payOrder && <PaymentDialog orderId={payOrder} onClose={() => setPayOrder(null)} />}
      {settle && <SettleDialog tx={settle} onClose={() => setSettle(null)} />}
    </section>
  );
}

/** Valores a receber que não são de serviço (o resto aparece no pátio, na linha do carro). */
function OtherReceivables() {
  const { view, can } = useApp();
  if (!can("finance.view")) return null;
  const list = listReceivables(view).filter((r) => !r.order);
  if (list.length === 0) return null;
  const total = list.reduce((s, r) => s + r.amountCents, 0);
  return (
    <Link href="/financeiro" className="rail-line">
      <CircleDollarSign aria-hidden />
      <span><strong>{formatBRL(total)}</strong> a receber fora de serviço ({list.length})</span>
      <span className="rail-line-go">Ver →</span>
    </Link>
  );
}

/** Coluna ao lado do pátio: quem chega hoje + avisos de uma linha. */
export function TodayRail() {
  const { can, settings } = useApp();
  const showArrivals = can("schedule.manage") && settings.activeModules.includes("schedule");
  return (
    <aside className="hoje-rail" aria-label="Também hoje">
      {showArrivals && <Arrivals compact />}
      <StockLine />
      <OtherReceivables />
      <TodayTour />
    </aside>
  );
}

function TodayTour() {
  return (
    <GuidedTour
      id="hoje"
      steps={[
        {
          target: "[data-tour=arrived]",
          title: "O cliente chegou? Clique aqui",
          body: <p>Abre o serviço já preenchido com o nome, o carro e o que foi marcado. É só conferir e salvar.</p>,
          illustration: <IllusTap label="Chegou: abrir serviço" />,
        },
        {
          target: "[data-tour=next-step]",
          title: "Cada carro tem um botão só",
          body: <p>O carro anda sozinho: <strong>Começar</strong> → <strong>Marcar como pronto</strong> → <strong>Receber</strong>. É sempre o botão azul da linha.</p>,
          illustration: <IllusTap label="Começar" />,
        },
        {
          target: "[data-tour=receive]",
          title: "Na hora de pagar, clique em Receber",
          body: <p>Escolha como o cliente pagou (dinheiro, PIX, cartão) e confirme. O valor vai sozinho para o Financeiro.</p>,
          illustration: <IllusTap label="Receber" />,
        },
        {
          target: "[data-tour=nav-orders]",
          title: "O quadro completo",
          body: <p>Em <strong>Serviços</strong> você vê todos os carros por etapa e pode arrastar.</p>,
        },
      ]}
    />
  );
}

/**
 * Tela "Hoje" do financeiro: a primeira coisa depois de entrar. Duas perguntas do balcão —
 * quem chega e quem falta pagar — com o botão da ação ao lado de cada nome.
 */
export function TodayPanel() {
  const { can, settings } = useApp();
  const showArrivals = can("schedule.manage") && settings.activeModules.includes("schedule");
  const showPayments = can("os.view") && settings.activeModules.includes("orders");
  if (!showArrivals && !showPayments) return null;
  return (
    <>
      <div className={showArrivals && showPayments ? "today-grid" : "today-grid is-single"}>
        {showArrivals && <Arrivals />}
        {showPayments && <Payments />}
      </div>
      <GuidedTour
        id="hoje"
        steps={[
          {
            target: "[data-tour=arrived]",
            title: "O cliente chegou? Clique aqui",
            body: <p>Abre o serviço já preenchido com o nome, o carro e o que foi marcado. É só conferir e salvar.</p>,
            illustration: <IllusTap label="Chegou: abrir serviço" />,
          },
          {
            target: "[data-tour=receive]",
            title: "Na hora de pagar, clique em Receber",
            body: <p>Escolha como o cliente pagou (dinheiro, PIX, cartão) e confirme. O valor vai sozinho para o Financeiro.</p>,
            illustration: <IllusTap label="Receber" />,
          },
          {
            target: "[data-tour=nav-orders]",
            title: "Todos os carros da oficina",
            body: <p>Em <strong>Serviços</strong> você vê cada carro e em que etapa ele está.</p>,
          },
        ]}
      />
    </>
  );
}
