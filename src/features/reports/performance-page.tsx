"use client";

import { ArrowDownRight, ArrowUpRight, ChatCircleText, FileArrowDown, Medal, UserMinus, Wrench } from "@phosphor-icons/react";
import { useState } from "react";
import { useApp } from "@/app-state/app-context";
import { MoreDetails } from "@/components/ui/choice";
import { CountUp } from "@/components/ui/count-up";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Button, PageHeader } from "@/components/ui/primitives";
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
  { value: "90", label: "Últimos 3 meses" },
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
  const top = Math.max(1, ...p.mechanics.map((m) => m.totalCents));
  const topService = Math.max(1, ...p.services.map((s) => s.count));
  const periodLabel = preset === "month" ? `em ${monthName(from)}` : preset === "last_month" ? `em ${monthName(from)}` : "nos últimos 3 meses";

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

  return (
    <div className="module-page module-performance">
      <PageHeader
        title="Desempenho"
        description="Quem fez, o que a oficina mais faz e quais clientes chamar de volta. O dinheiro do caixa fica no Financeiro."
        actions={can("reports.export") && <Button variant="primary" className="rounded-full" icon={<FileArrowDown size={18} weight="duotone" aria-hidden />} loading={busy} onClick={sendToAccountant}>Mandar para o contador</Button>}
      />

      <div role="group" aria-label="Período" className="perf-periods">
        {PRESETS.map((x) => (
          <button key={x.value} type="button" aria-pressed={x.value === preset} onClick={() => setPreset(x.value)}>{x.label}</button>
        ))}
        <span className="perf-range">{formatDate(from)} a {formatDate(to)}</span>
      </div>

      <div key={preset} className="perf-stats">
        <Stat label="Serviços prontos" value={p.count} prev={p.previous.count} />
        <Stat label="Valor dos serviços" value={p.totalCents} prev={p.previous.totalCents} money />
        <Stat label="Valor médio por serviço" value={p.avgCents} prev={p.previous.avgCents} money />
      </div>

      <div key={`g-${preset}`} className="perf-grid">
        <section className="perf-card" aria-labelledby="perf-mech">
          <h2 id="perf-mech" className="perf-title"><Wrench size={22} weight="duotone" aria-hidden /> Quem fez</h2>
          {p.mechanics.length === 0 ? <p className="perf-empty">Nenhum serviço pronto {periodLabel}.</p> : (
            <ul className="perf-list">
              {p.mechanics.map((m, i) => (
                <li key={m.userId ?? "none"} className="perf-row" style={{ "--i": i } as React.CSSProperties}>
                  <PersonAvatar name={m.name} size={40} />
                  <div className="perf-row-main">
                    <div className="perf-row-line"><strong>{m.name.split(" ").slice(0, 2).join(" ")}</strong><span className="perf-money">{formatBRL(m.totalCents)}</span></div>
                    <div className="perf-bar" aria-hidden><span style={{ "--w": m.totalCents / top } as React.CSSProperties} /></div>
                    <p className="perf-row-sub">{m.count} {m.count === 1 ? "serviço" : "serviços"} · mão de obra {formatBRL(m.laborCents)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="perf-card" aria-labelledby="perf-svc">
          <h2 id="perf-svc" className="perf-title"><Medal size={22} weight="duotone" aria-hidden /> O que a oficina mais faz</h2>
          {p.services.length === 0 ? <p className="perf-empty">Nenhum serviço pronto {periodLabel}.</p> : (
            <ol className="perf-list">
              {p.services.map((s, i) => (
                <li key={s.label} className="perf-row" style={{ "--i": i } as React.CSSProperties}>
                  <span className="perf-rank" aria-hidden>{i + 1}</span>
                  <div className="perf-row-main">
                    <div className="perf-row-line"><strong>{s.label}</strong><span className="perf-count">{s.count}×</span></div>
                    <div className="perf-bar is-soft" aria-hidden><span style={{ "--w": s.count / topService } as React.CSSProperties} /></div>
                    <p className="perf-row-sub">Média de {formatBRL(s.avgCents)} cada · total {formatBRL(s.totalCents)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="perf-card" aria-labelledby="perf-loyal">
          <h2 id="perf-loyal" className="perf-title"><ArrowUpRight size={22} weight="duotone" aria-hidden /> Clientes que mais voltam</h2>
          <p className="perf-hint">Nos últimos 12 meses.</p>
          {p.loyal.length === 0 ? <p className="perf-empty">Ninguém voltou mais de uma vez ainda.</p> : (
            <ul className="perf-list">
              {p.loyal.map((c, i) => (
                <li key={c.customerId} className="perf-row" style={{ "--i": i } as React.CSSProperties}>
                  <PersonAvatar name={c.name} size={40} />
                  <div className="perf-row-main">
                    <div className="perf-row-line"><strong>{c.name}</strong><span className="perf-count">{c.visits} vezes</span></div>
                    <p className="perf-row-sub">Gastou {formatBRL(c.totalCents)} · última vez em {formatDate(c.lastDate)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="perf-card" aria-labelledby="perf-gone">
          <h2 id="perf-gone" className="perf-title"><UserMinus size={22} weight="duotone" aria-hidden /> Clientes sumidos</h2>
          <p className="perf-hint">Não aparecem há mais de 6 meses. Uma mensagem pode trazer de volta.</p>
          {p.gone.length === 0 ? <p className="perf-empty">Nenhum cliente sumido. Ótimo sinal.</p> : (
            <ul className="perf-list">
              {p.gone.map((c, i) => {
                const url = callBack(c.name, c.phone);
                return (
                  <li key={c.customerId} className="perf-row" style={{ "--i": i } as React.CSSProperties}>
                    <PersonAvatar name={c.name} size={40} />
                    <div className="perf-row-main">
                      <strong>{c.name}</strong>
                      <p className="perf-row-sub">Última vez há {monthsSince(c.lastDate)} meses ({formatDate(c.lastDate)})</p>
                    </div>
                    {url && <a className="perf-call" href={url} target="_blank" rel="noreferrer" aria-label={`Chamar ${c.name} no WhatsApp`}><ChatCircleText size={20} weight="duotone" aria-hidden /> Chamar</a>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <MoreDetails summary="Listas completas e planilhas (serviços, dinheiro, peças, histórico)">
        <ReportTables />
      </MoreDetails>
    </div>
  );
}

function Stat({ label, value, prev, money }: { label: string; value: number; prev: number; money?: boolean }) {
  const diff = value - prev;
  const pct = prev ? Math.round((diff / prev) * 100) : null;
  const fmt = (n: number) => (money ? formatBRL(n as Cents) : n.toLocaleString("pt-BR"));
  return (
    <div className="perf-stat">
      <p className="perf-stat-label">{label}</p>
      <p className="perf-stat-value"><CountUp value={value} format={fmt} /></p>
      <p className="perf-stat-delta" data-tone={!prev ? undefined : diff > 0 ? "up" : diff < 0 ? "down" : undefined}>
        {!prev ? "Sem comparação com o período anterior" : diff === 0 ? "Igual ao período anterior" : (
          // Porcentagem só quando faz sentido; com pouca base, a diferença em número ("17 a mais").
          <>{diff > 0 ? <ArrowUpRight size={16} weight="bold" aria-hidden /> : <ArrowDownRight size={16} weight="bold" aria-hidden />} {pct !== null && Math.abs(pct) <= 200 ? `${Math.abs(pct)}%` : fmt(Math.abs(diff))} {diff > 0 ? "a mais" : "a menos"} que no período anterior</>
        )}
      </p>
    </div>
  );
}
