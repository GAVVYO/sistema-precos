"use client";

import { CalendarClock, CarFront, CheckCircle2, Clock3, Maximize, Minimize, Wrench, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useApp } from "@/app-state/app-context";
import { BrandMark } from "@/components/ui/brand-mark";
import { CountUp } from "@/components/ui/count-up";
import { ORDER_STATUS_LABELS, ORDER_STATUSES } from "@/domain/labels";
import type { OrderStatus, ServiceOrder } from "@/domain/types";
import { vehicleLabel } from "@/features/orders/shared";
import { formatPlate, todayISO } from "@/lib/format";

/**
 * Modo TV da parede: quadro grande, escuro e de alto contraste para ver de longe
 * (referências: painéis de partida de aeroporto, Tech Board do Tekmetric, TV do
 * Shopmonkey). Sem valores em reais e com nomes abreviados (sala de espera).
 * Atualiza sozinho, inclusive quando a recepção mexe em outra aba/janela.
 */

const PAGE_MS = 10_000;
const ICON: Record<OrderStatus, typeof Clock3> = { waiting: Clock3, in_progress: Wrench, done: CheckCircle2 };
const TITLE: Record<OrderStatus, string> = { waiting: "Aguardando", in_progress: "Em andamento", done: "Pronto para retirar" };

/** "Renata Cavalcante Dias" → "Renata D." (privacidade em tela pública). */
function shortName(full?: string): string {
  if (!full) return "Cliente";
  const p = full.trim().split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0];
}

function since(iso: string, now: number): string {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}

function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), ms); return () => window.clearInterval(t); }, [ms]);
  return now;
}

function Tile({ status, icon, label, value }: { status: string; icon: ReactNode; label: string; value: number }) {
  return (
    <div className="tv-tile" data-status={status}>
      <span className="tv-tile-label">{icon}{label}</span>
      <span className="tv-tile-value"><CountUp value={value} duration={900} /></span>
    </div>
  );
}

export function TvPage() {
  const { view, settings, customerOf, vehicleOf, userOf } = useApp();
  const router = useRouter();
  const now = useNow(15_000);
  const clock = useNow(1000);
  const [page, setPage] = useState(0);
  const [idle, setIdle] = useState(false);
  const [full, setFull] = useState(false);
  const seen = useRef<Map<string, OrderStatus> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  // Quantos cartões cabem por coluna: medido na tela real (TV, notebook, monitor).
  const board = useRef<HTMLElement>(null);
  const [PAGE_SIZE, setPageSize] = useState(3);
  useLayoutEffect(() => {
    const el = board.current;
    if (!el) return;
    const measure = () => {
      const col = el.querySelector<HTMLElement>(".tv-col");
      const card = el.querySelector<HTMLElement>(".tv-card");
      const title = el.querySelector<HTMLElement>(".tv-col-title");
      if (!col || !card || !title) return;
      const gap = parseFloat(getComputedStyle(card.parentElement!).rowGap) || 0;
      const avail = col.clientHeight - title.offsetHeight - 64; // título, espaçamentos e pontinhos
      setPageSize(Math.max(1, Math.floor((avail + gap) / (card.offsetHeight + gap))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const active = view.orders.filter((o) => !o.cancelledAt);
  const today = todayISO();
  const doneShown = active.filter((o) => o.status === "done" && !o.paymentId); // prontos esperando retirada
  const columns: Record<OrderStatus, ServiceOrder[]> = {
    waiting: active.filter((o) => o.status === "waiting").sort((a, b) => a.openedAt.localeCompare(b.openedAt)),
    in_progress: active.filter((o) => o.status === "in_progress").sort((a, b) => a.openedAt.localeCompare(b.openedAt)),
    done: doneShown.sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")),
  };
  const arrivals = view.appointments
    .filter((a) => a.date === today && (a.status === "scheduled" || a.status === "confirmed"))
    .sort((a, b) => a.time.localeCompare(b.time));
  const pages = Math.max(1, ...ORDER_STATUSES.map((s) => Math.ceil(columns[s].length / PAGE_SIZE)));
  const current = page % pages;

  // Quando entra na etapa: último registro "Etapa mudou para…", senão a abertura.
  const enteredAt = (o: ServiceOrder) => {
    const ev = view.orderEvents.filter((e) => e.orderId === o.id && e.message.startsWith("Etapa mudou")).sort((a, b) => b.at.localeCompare(a.at))[0];
    return o.status === "done" ? o.completedAt ?? ev?.at ?? o.openedAt : ev?.at ?? o.openedAt;
  };

  // Carro que chegou ou mudou de etapa ganha destaque por alguns segundos.
  const signature = active.map((o) => `${o.id}:${o.status}`).join("|");
  useEffect(() => {
    const prev = seen.current;
    const next = new Map(active.map((o) => [o.id, o.status] as const));
    seen.current = next;
    if (!prev) return;
    const changed = [...next].filter(([id, st]) => prev.get(id) !== st).map(([id]) => id);
    if (!changed.length) return;
    const t0 = window.setTimeout(() => setFresh(new Set(changed)), 0);
    const t1 = window.setTimeout(() => setFresh(new Set()), 6000);
    return () => { window.clearTimeout(t0); window.clearTimeout(t1); };
    // A assinatura resume a lista; recalcular a cada render seria desnecessário.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => { const t = window.setInterval(() => setPage((p) => p + 1), PAGE_MS); return () => window.clearInterval(t); }, []);

  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };

  // Controles somem com o mouse parado; Esc sai; F alterna tela cheia.
  useEffect(() => {
    let t = window.setTimeout(() => setIdle(true), 3000);
    const wake = () => { setIdle(false); window.clearTimeout(t); t = window.setTimeout(() => setIdle(true), 3000); };
    const key = (e: KeyboardEvent) => {
      wake();
      if (e.key === "Escape" && !document.fullscreenElement) router.push("/inicio");
      if (e.key.toLowerCase() === "f") toggleFull();
    };
    const fs = () => setFull(!!document.fullscreenElement);
    window.addEventListener("pointermove", wake);
    window.addEventListener("keydown", key);
    document.addEventListener("fullscreenchange", fs);
    return () => { window.clearTimeout(t); window.removeEventListener("pointermove", wake); window.removeEventListener("keydown", key); document.removeEventListener("fullscreenchange", fs); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const time = new Date(clock).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const date = new Date(clock).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="tv" data-idle={idle || undefined}>
      <header className="tv-head">
        <div className="tv-brand">
          {settings.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logoDataUrl} alt="" className="tv-logo bg-white object-contain" />
          ) : (
            <BrandMark className="tv-logo" />
          )}
          <div>
            <p className="tv-name">{settings.displayName}</p>
            <p className="tv-sub"><span className="tv-live" aria-hidden />Acompanhe seu carro</p>
          </div>
        </div>
        <div className="tv-clock" aria-label={`${time}, ${date}`}>
          <span className="tv-time">{time}</span>
          <span className="tv-date">{date}</span>
        </div>
      </header>

      <section className="tv-tiles" aria-label="Resumo">
        <Tile status="waiting" icon={<Clock3 aria-hidden />} label="Aguardando" value={columns.waiting.length} />
        <Tile status="in_progress" icon={<Wrench aria-hidden />} label="Em andamento" value={columns.in_progress.length} />
        <Tile status="done" icon={<CheckCircle2 aria-hidden />} label="Prontos para retirar" value={columns.done.length} />
        <Tile status="arrivals" icon={<CalendarClock aria-hidden />} label="Chegam hoje" value={arrivals.length} />
      </section>

      <main ref={board} className="tv-board">
        {ORDER_STATUSES.map((s) => {
          const Icon = ICON[s];
          const list = columns[s];
          const slice = list.slice((current % Math.max(1, Math.ceil(list.length / PAGE_SIZE))) * PAGE_SIZE, (current % Math.max(1, Math.ceil(list.length / PAGE_SIZE))) * PAGE_SIZE + PAGE_SIZE);
          return (
            <section key={s} className="tv-col" data-status={s} aria-label={`${TITLE[s]}: ${list.length}`}>
              <h2 className="tv-col-title"><Icon aria-hidden />{TITLE[s]}<span className="tv-col-count">{list.length}</span></h2>
              <ul className="tv-cards" key={`${s}-${current}`}>
                {slice.map((o, i) => {
                  const v = vehicleOf(o.vehicleId);
                  const mech = userOf(o.mechanicId)?.name.split(" ")[0];
                  return (
                    <li key={o.id} className="tv-card" data-fresh={fresh.has(o.id) || undefined} style={{ ["--i" as string]: i }}>
                      <span className="tv-plate">{v ? formatPlate(v.plate) : "—"}</span>
                      <span className="tv-car"><CarFront aria-hidden />{vehicleLabel(v)}</span>
                      <span className="tv-who">{shortName(customerOf(o.customerId)?.name)}{mech ? ` · ${mech}` : ""}</span>
                      <span className="tv-since">{s === "done" ? "Pronto" : ORDER_STATUS_LABELS[s]} {since(enteredAt(o), now)}</span>
                    </li>
                  );
                })}
                {list.length === 0 && <li className="tv-empty">{s === "done" ? "Nenhum carro esperando retirada" : "Nenhum carro nesta etapa"}</li>}
              </ul>
              {list.length > PAGE_SIZE && (
                <div className="tv-dots" aria-hidden>
                  {Array.from({ length: Math.ceil(list.length / PAGE_SIZE) }, (_, i) => <span key={i} data-on={i === current % Math.ceil(list.length / PAGE_SIZE) || undefined} />)}
                </div>
              )}
            </section>
          );
        })}
      </main>

      <footer className="tv-foot">
        <span className="tv-foot-label"><CalendarClock aria-hidden />Próximos horários</span>
        <div className="tv-ticker">
          {arrivals.length === 0 ? <span>Nenhum outro horário marcado hoje</span> : arrivals.map((a) => <span key={a.id}><b>{a.time}</b> {shortName(a.customerName)} · {a.model}</span>)}
        </div>
      </footer>

      <div className="tv-controls">
        <button type="button" onClick={toggleFull}>{full ? <Minimize aria-hidden /> : <Maximize aria-hidden />}{full ? "Sair da tela cheia" : "Tela cheia (F)"}</button>
        <button type="button" onClick={() => router.push("/inicio")}><X aria-hidden />Sair da TV (Esc)</button>
      </div>
    </div>
  );
}
