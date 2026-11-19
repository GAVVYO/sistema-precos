"use client";

import { ArrowDownRight, ArrowUpRight, ChatCircleText, FileArrowDown, Medal, Wrench } from "@phosphor-icons/react";
import { useState } from "react";
import { useApp } from "@/app-state/app-context";
import { MoreDetails } from "@/components/ui/choice";
import { CountUp } from "@/components/ui/count-up";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Button } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import type { Cents, ISODate } from "@/domain/types";
import { exportWorkbookXlsx } from "@/lib/export";
import { addDays, addMonths, endOfMonth, formatBRL, formatDate, monthName, startOfMonth, todayISO } from "@/lib/format";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { buildPerformance } from "@/services/performance";
import { buildReport, REPORTS } from "@/services/reports";
import { ReportTables } from "./reports-page";

/**
 * Desempenho (decisão 77): o que nenhuma outra tela mostra. O dinheiro do
 * caixa fica no Financeiro. Aqui: quem fez, o que a oficina mais faz, quanto
 * vale um serviço e quais clientes voltam ou sumiram (com WhatsApp para chamar).
 * As listas completas e as planilhas ficam no fim, recolhidas.
 */

type Preset = "month" | "last_month" | "90";
const PRESETS: { value: Preset; label: string }[] = [
  { value: "month", label: "Este mês" },
  { value: "last_month", label: "Mês passado" },
  { value: "90", label: "3 meses" },
];

function range(p: Preset): { from: ISODate; to: ISODate } {
  const today = todayISO();
  if (p === "month") return { from: startOfMonth(today), to: today };
  if (p === "last_month") { const s = startOfMonth(addMonths(today, -1)); return { from: s, to: endOfMonth(s) }; }
  return { from: addDays(today, -89), to: today };
}

const monthsSince = (date: ISODate) => Math.max(1, Math.round((Date.parse(todayISO()) - Date.parse(date)) / (30.4 * 86_400_000)));

export function PerformancePage() {
  const { view, can, settings } = useApp();
  const [preset, setPreset] = useState<Preset>("month");
  const [busy, setBusy] = useState(false);
  const { from, to } = range(preset);
  const p = buildPerformance(view, from, to);
  const topCount = Math.max(1, ...p.mechanics.map((m) => m.count));

  const sendToAccountant = async () => {
    setBusy(true);
    try {
      const filters = { from, to, option: "", mechanicId: "", text: "" };
      const reports = REPORTS.filter((r) => can(r.permission)).map((r) => buildReport(view, r.kind, filters));
      await exportWorkbookXlsx(reports, { workshopName: settings.displayName, logoDataUrl: settings.logoDataUrl, primaryColor: settings.primaryColor }, `Contador ${formatDate(from)} a ${formatDate(to)}`);
      toast("success", `Planilha pronta, com ${reports.length} abas. Mande o arquivo para o contador.`);
    } catch (e) {
      console.error(e);
      toast("error", "Não foi possível gerar a planilha. Tente de novo.");
    }
    setBusy(false);
  };

  const callBack = (name: string, phone: string) =>
    buildWhatsAppUrl(phone, `Olá, ${name.split(" ")[0]}! Aqui é da ${settings.displayName}. Faz um tempo que não vemos seu carro por aqui. Que tal uma revisão? Temos horário esta semana.`);

  const when = preset === "90" ? "Nos últimos 3 meses" : `Em ${monthName(from).split(" ")[0]}`;
  const diff = p.count - p.previous.count;

  return (
    <div className="module-page module-performance">
      <header className="pf-head">
        <div>
          <h1 className="pf-h1">Desempenho</h1>
          <div role="group" aria-label="Período" className="pf-periods">
            {PRESETS.map((x) => (
              <button key={x.value} type="button" aria-pressed={x.value === preset} onClick={() => setPreset(x.value)}>{x.label}</button>
            ))}
          </div>
        </div>
        {can("reports.export") && (
          <Button className="rounded-full" icon={<FileArrowDown size={18} weight="duotone" aria-hidden />} loading={busy} onClick={sendToAccountant}>Mandar para o contador</Button>
        )}
      </header>

      {/* Uma frase no lugar de três cartões de número: lê-se como o dono contaria o mês. */}
      <section key={`h-${preset}`} className="pf-hero" aria-label="Resumo do período">
        {p.count === 0 ? (
          <p className="pf-sentence">{when} nenhum carro foi entregue ainda.</p>
        ) : (
          <>
            <p className="pf-sentence">
              {when} a oficina entregou <strong><CountUp value={p.count} /> {p.count === 1 ? "carro" : "carros"}</strong> e os serviços somaram <strong><CountUp value={p.totalCents} format={(n) => formatBRL(n as Cents)} /></strong>.
            </p>
            <p className="pf-sub">
              Em média, {formatBRL(p.avgCents)} por carro.
              {p.previous.count > 0 && diff !== 0 && (
                <span className="pf-delta" data-tone={diff > 0 ? "up" : "down"}>
                  {diff > 0 ? <ArrowUpRight size={16} weight="bold" aria-hidden /> : <ArrowDownRight size={16} weight="bold" aria-hidden />}
                  {Math.abs(diff)} {Math.abs(diff) === 1 ? "carro" : "carros"} a {diff > 0 ? "mais" : "menos"} que no período anterior
                </span>
              )}
            </p>
          </>
        )}
      </section>

      <div key={`g-${preset}`} className="pf-two">
        <section aria-labelledby="pf-mech">
          <h2 id="pf-mech" className="pf-h2"><Wrench size={22} weight="duotone" aria-hidden /> Quem entregou</h2>
          {p.mechanics.length === 0 ? <p className="pf-empty">Ninguém entregou carro neste período.</p> : (
            <ul className="pf-board">
              {p.mechanics.map((m, i) => (
                <li key={m.userId ?? "none"} style={{ "--i": i } as React.CSSProperties}>
                  <PersonAvatar name={m.name} size={48} />
                  <div className="pf-board-main">
                    <span className="pf-board-name">{m.name.split(" ")[0]}</span>
                    <span className="pf-bar" aria-hidden><span style={{ "--w": m.count / topCount } as React.CSSProperties} /></span>
                  </div>
                  <span className="pf-board-num"><span><strong>{m.count}</strong> {m.count === 1 ? "carro" : "carros"}</span><small>{formatBRL(m.totalCents)}</small></span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="pf-svc">
          <h2 id="pf-svc" className="pf-h2"><Medal size={22} weight="duotone" aria-hidden /> O que mais sai</h2>
          {p.services.length === 0 ? <p className="pf-empty">Nenhum serviço neste período.</p> : (
            <ol className="pf-rank">
              {p.services.map((s, i) => (
                <li key={s.label} style={{ "--i": i } as React.CSSProperties} title={`Média de ${formatBRL(s.avgCents)} cada`}>
                  <span className="pf-rank-n" aria-hidden>{i + 1}</span>
                  <span className="pf-rank-label">{s.label}</span>
                  <span className="pf-rank-count">{s.count}×</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="pf-back" aria-labelledby="pf-gone">
        <div className="pf-back-head">
          <h2 id="pf-gone" className="pf-h2"><ChatCircleText size={22} weight="duotone" aria-hidden /> Chamar de volta</h2>
          <p className="pf-hint">{p.gone.length ? `${p.gone.length} ${p.gone.length === 1 ? "cliente não aparece" : "clientes não aparecem"} há mais de 6 meses. Uma mensagem pode trazer o carro de volta.` : "Nenhum cliente sumido há mais de 6 meses. Ótimo sinal."}</p>
        </div>
        {!!p.gone.length && (
          <ul className="pf-gone">
            {p.gone.map((c, i) => {
              const url = callBack(c.name, c.phone);
              return (
                <li key={c.customerId} style={{ "--i": i } as React.CSSProperties}>
                  <PersonAvatar name={c.name} size={44} />
                  <span className="pf-gone-text"><strong>{c.name.split(" ").slice(0, 2).join(" ")}</strong><small>há {monthsSince(c.lastDate)} meses</small></span>
                  {url && <a className="pf-call" href={url} target="_blank" rel="noreferrer" aria-label={`Chamar ${c.name} no WhatsApp`}><ChatCircleText size={20} weight="fill" aria-hidden /> Chamar</a>}
                </li>
              );
            })}
          </ul>
        )}
        {!!p.loyal.length && (
          <p className="pf-loyal">
            <span className="pf-loyal-label">Clientes fiéis:</span>
            {p.loyal.map((c) => <span key={c.customerId} className="pf-loyal-item" title={`${c.visits} vezes no ano · ${formatBRL(c.totalCents)}`}>{c.name.split(" ")[0]} <b>{c.visits}×</b></span>)}
          </p>
        )}
      </section>

      <MoreDetails summary="Listas completas e planilhas">
        <ReportTables />
      </MoreDetails>
    </div>
  );
}

