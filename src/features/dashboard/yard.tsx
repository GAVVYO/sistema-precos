"use client";

import { CarFront, CircleDollarSign, PackageX, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/app-state/app-context";
import { Button } from "@/components/ui/primitives";
import type { OrderStatus, ServiceOrder } from "@/domain/types";
import { PaymentDialog } from "@/features/orders/order-dialogs";
import { QuickOrderAction } from "@/features/orders/quick-order-action";
import { vehicleLabel } from "@/features/orders/shared";
import { addDays, dateOf, formatBRL, formatPlate, formatTime, todayISO } from "@/lib/format";
import { vtName } from "@/lib/view-transition";
import { orderTotals, paymentSituation } from "@/services/orders";
import { partSituation } from "@/services/stock";

/**
 * "Pátio": a tela Hoje mostra os carros que estão na oficina, um por linha,
 * agrupados pelo caminho que o carro faz (esperando → sendo feito → pronto).
 * Cada linha tem a placa desenhada (a âncora visual do produto), o carro, o
 * cliente, o serviço e UMA ação. Substitui os cartões coloridos de números,
 * a tabela com filtros e a atividade recente (auditoria leiga G1).
 */

export function sinceShop(openedAt: string): string {
  const d = dateOf(openedAt);
  const today = todayISO();
  if (d === today) return `Chegou ${formatTime(openedAt)}`;
  if (d === addDays(today, -1)) return "Chegou ontem";
  const days = Math.round((Date.parse(today) - Date.parse(d)) / 86400000);
  return `Há ${days} dias`;
}

export function MiniPlate({ plate }: { plate?: string }) {
  return (
    <span className="mini-plate">
      <span className="mini-plate-band" aria-hidden>BRASIL</span>
      <span className="sr-only">{plate ? `Placa ${formatPlate(plate).split("").join(" ")}.` : "Sem placa."}</span>
      <span className="mini-plate-text" aria-hidden>{plate ? formatPlate(plate) : "———"}</span>
    </span>
  );
}

const STEPS: { key: OrderStatus; label: string }[] = [
  { key: "waiting", label: "Esperando" },
  { key: "in_progress", label: "Fazendo" },
  { key: "done", label: "Pronto" },
];

/** Caminho do carro: três tracinhos, preenchidos até a etapa atual (com texto, cor nunca sozinha). */
function Track({ status }: { status: OrderStatus }) {
  const at = STEPS.findIndex((s) => s.key === status);
  return (
    <span className="yard-track" data-status={status} aria-hidden>
      {STEPS.map((s, i) => <i key={s.key} data-on={i <= at || undefined} />)}
    </span>
  );
}

function YardRow({ order, showMoney, mineLabel }: { order: ServiceOrder; showMoney: boolean; mineLabel?: boolean }) {
  const { view, can, online, customerOf, vehicleOf, userOf, openOrder } = useApp();
  const [pay, setPay] = useState(false);
  const v = vehicleOf(order.vehicleId);
  const customer = customerOf(order.customerId)?.name ?? "Cliente";
  const mechanic = userOf(order.mechanicId)?.name.split(" ")[0];
  const totals = orderTotals(view, order);
  const owes = order.status === "done" && paymentSituation(order, totals) === "pending";
  return (
    <li className="yard-row" data-order-id={order.id} data-status={order.status} style={{ ["--vt" as string]: vtName("yard", order.id) }}>
      <MiniPlate plate={v?.plate} />
      <span className="yard-main">
        <button type="button" className="yard-car" onClick={() => openOrder(order.id)}>
          {vehicleLabel(v)} <span className="yard-owner">· <strong>{customer}</strong></span>
        </button>
        <span className="yard-what">{order.description}</span>
        <span className="yard-meta">
          <Track status={order.status} />
          <span className="sr-only">{order.status === "done" ? "Pronto." : order.status === "in_progress" ? "Sendo feito." : "Esperando começar."}</span>
          {!mineLabel && <span>{mechanic ? `Com ${mechanic}` : "Ninguém pegou ainda"} ·</span>}
          <span>{sinceShop(order.openedAt)}</span>
        </span>
      </span>
      <span className="yard-action">
        {owes ? (
          showMoney ? (
            <>
              <span className="yard-value">{formatBRL(totals.totalCents)}</span>
              {can("finance.payment") ? (
                <Button data-tour="receive" variant="primary" icon={<CircleDollarSign className="size-4" aria-hidden />} disabled={!online} onClick={() => setPay(true)}>Receber</Button>
              ) : <span className="yard-hint">Quem recebe: dono ou financeiro</span>}
            </>
          ) : <span className="yard-hint">Esperando o cliente</span>
        ) : order.status === "in_progress" && !can("os.complete") ? (
          <span className="yard-hint">O mecânico marca quando ficar pronto</span>
        ) : (
          <QuickOrderAction order={order} size="md" statusOnly />
        )}
      </span>
      {pay && <PaymentDialog orderId={order.id} onClose={() => setPay(false)} />}
    </li>
  );
}

function Lane({ id, title, hint, orders, showMoney, mineLabel }: { id: string; title: string; hint?: string; orders: ServiceOrder[]; showMoney: boolean; mineLabel?: boolean }) {
  if (orders.length === 0) return null;
  return (
    <section className="yard-lane" aria-labelledby={`lane-${id}`} data-lane={id}>
      <h3 id={`lane-${id}`} className="yard-lane-title">
        <span className="yard-dot" aria-hidden />{title} <span className="yard-count">{orders.length}</span>
        {hint && <span className="yard-lane-hint">{hint}</span>}
      </h3>
      <ul className="yard-list">
        {orders.map((o) => <YardRow key={o.id} order={o} showMoney={showMoney} mineLabel={mineLabel} />)}
      </ul>
    </section>
  );
}

const byOpened = (a: ServiceOrder, b: ServiceOrder) => a.openedAt.localeCompare(b.openedAt);

/** Carros na oficina: abertos + prontos que ainda não foram pagos (o carro ainda está lá). */
export function useYard() {
  const { view } = useApp();
  const active = view.orders.filter((o) => !o.cancelledAt);
  const inShop = active.filter((o) => o.status !== "done" || paymentSituation(o, orderTotals(view, o)) === "pending");
  return {
    waiting: inShop.filter((o) => o.status === "waiting").sort(byOpened),
    doing: inShop.filter((o) => o.status === "in_progress").sort(byOpened),
    ready: inShop.filter((o) => o.status === "done").sort(byOpened),
    count: new Set(inShop.map((o) => o.vehicleId)).size,
  };
}

export function Yard() {
  const { can, settings, openNewOrder, online } = useApp();
  const { waiting, doing, ready } = useYard();
  const showMoney = can("finance.payment") || can("finance.view");
  const empty = waiting.length + doing.length + ready.length === 0;
  return (
    <section className="yard" aria-labelledby="yard-title">
      <h2 id="yard-title" className="sr-only">Carros na oficina</h2>
      {empty ? (
        <div className="yard-empty">
          <span className="yard-empty-art" aria-hidden><CarFront /></span>
          <p className="yard-empty-title">Pátio vazio</p>
          <p className="yard-empty-text">Nenhum carro na oficina agora. Quando um chegar, abra o serviço.</p>
          {can("os.create") && settings.activeModules.includes("orders") && (
            <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} disabled={!online} onClick={() => openNewOrder()}>Novo serviço</Button>
          )}
        </div>
      ) : (
        <>
          <Lane id="waiting" title="Esperando começar" orders={waiting} showMoney={showMoney} />
          <Lane id="doing" title="Sendo feito" orders={doing} showMoney={showMoney} />
          <Lane id="ready" title="Pronto, esperando o cliente" hint={showMoney ? "receber e entregar" : undefined} orders={ready} showMoney={showMoney} />
        </>
      )}
    </section>
  );
}

/** Mecânico: só os carros dele; nada de dinheiro. */
export function MechanicYard() {
  const { view, user } = useApp();
  const mine = view.orders.filter((o) => !o.cancelledAt && o.mechanicId === user.id);
  const waiting = mine.filter((o) => o.status === "waiting").sort(byOpened);
  const doing = mine.filter((o) => o.status === "in_progress").sort(byOpened);
  const doneToday = mine.filter((o) => o.status === "done" && o.completedAt && dateOf(o.completedAt) === todayISO()).length;
  const free = view.orders.filter((o) => !o.cancelledAt && o.status === "waiting" && !o.mechanicId).length;
  return (
    <section className="yard" aria-labelledby="yard-mine-title">
      <h2 id="yard-mine-title" className="sr-only">Seus carros</h2>
      {waiting.length + doing.length === 0 ? (
        <div className="yard-empty">
          <span className="yard-empty-art" aria-hidden><CarFront /></span>
          <p className="yard-empty-title">Nenhum carro com você agora</p>
          <p className="yard-empty-text">Quando passarem um carro para você, ele aparece aqui.</p>
        </div>
      ) : (
        <>
          <Lane id="doing" title="Você está fazendo" orders={doing} showMoney={false} mineLabel />
          <Lane id="waiting" title="Para você começar" orders={waiting} showMoney={false} mineLabel />
        </>
      )}
      <p className="yard-foot">
        {doneToday > 0 && <>Você terminou <strong>{doneToday} {doneToday === 1 ? "carro" : "carros"}</strong> hoje. </>}
        {free > 0 && <>{free === 1 ? "1 carro está" : `${free} carros estão`} esperando alguém pegar — <Link href="/ordens" className="yard-link">ver no quadro</Link>.</>}
      </p>
    </section>
  );
}

/** Uma linha só para o estoque (antes era um cartão inteiro). */
export function StockLine() {
  const { view, can, settings } = useApp();
  if (!can("stock.view") || !settings.activeModules.includes("stock")) return null;
  const low = view.parts.filter((p) => partSituation(p) !== "ok");
  if (low.length === 0) return null;
  const out = low.filter((p) => p.quantity <= 0).length;
  return (
    <Link href="/estoque" className="rail-line">
      <PackageX aria-hidden />
      <span><strong>{low.length} {low.length === 1 ? "peça acabando" : "peças acabando"}</strong>{out > 0 && <> · {out} já {out === 1 ? "acabou" : "acabaram"}</>}</span>
      <span className="rail-line-go">Ver estoque →</span>
    </Link>
  );
}
