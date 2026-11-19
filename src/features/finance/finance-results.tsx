"use client";

import { ChatCircleText, FileArrowDown, Medal, UsersThree, Wrench } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useApp } from "@/app-state/app-context";
import { MoreDetails } from "@/components/ui/choice";
import type { Period } from "@/components/ui/period";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Button } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import type { Cents, ISODate } from "@/domain/types";
import { ReportTables } from "@/features/reports/reports-page";
import { exportWorkbookXlsx } from "@/lib/export";
import { formatBRL, formatDate, todayISO } from "@/lib/format";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { buildPerformance } from "@/services/performance";
import { buildReport, REPORTS } from "@/services/reports";

/**
 * Financeiro › Resultados (decisão 79): o que era a tela Desempenho, em quadros
 * simples dentro do Financeiro, no mesmo período escolhido no alto da página.
 * Um quadro por pergunta, uma linha por pessoa ou serviço, um número por linha.
 */

const monthsSince = (date: ISODate) => Math.max(1, Math.round((Date.parse(todayISO()) - Date.parse(date)) / (30.4 * 86_400_000)));

export function FinanceResults({ period }: { period: Period }) {
  const { view, can, settings } = useApp();
  const [busy, setBusy] = useState(false);
  const p = buildPerformance(view, period.from, period.to);
  const topMech = Math.max(1, ...p.mechanics.map((m) => m.totalCents));
  const diff = p.count - p.previous.count;

  const sendToAccountant = async () => {
    setBusy(true);
    try {
      const filters = { from: period.from, to: period.to, option: "", mechanicId: "", text: "" };
      const reports = REPORTS.filter((r) => can(r.permission)).map((r) => buildReport(view, r.kind, filters));
      await exportWorkbookXlsx(reports, { workshopName: settings.displayName, logoDataUrl: settings.logoDataUrl, primaryColor: settings.primaryColor }, `Contador ${formatDate(period.from)} a ${formatDate(period.to)}`);
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
    <div className="fr">
      <div className="fr-top">
        <p className="fr-line">
          {p.count === 0 ? "Nenhum carro ficou pronto neste período." : (
            <>
              <strong>{p.count} {p.count === 1 ? "carro pronto" : "carros prontos"}</strong> · cada um deu em média <strong>{formatBRL(p.avgCents)}</strong>
              {p.previous.count > 0 && diff !== 0 && <span className="fr-delta" data-tone={diff > 0 ? "up" : "down"}>{Math.abs(diff)} a {diff > 0 ? "mais" : "menos"} que no período anterior</span>}
            </>
          )}
        </p>
        {can("reports.export") && (
          <Button icon={<FileArrowDown size={18} weight="duotone" aria-hidden />} loading={busy} onClick={sendToAccountant}>Mandar para o contador</Button>
        )}
      </div>

      <div className="fr-grid">
        <Box icon={<Wrench size={22} weight="duotone" />} title="Quanto cada mecânico fez" hint="Valor dos serviços que cada um deixou pronto." empty={!p.mechanics.length && "Nenhum carro ficou pronto neste período."}>
          {p.mechanics.map((m, i) => (
            <li key={m.userId ?? "none"} className="fr-row" style={{ "--i": i } as React.CSSProperties}>
              <PersonAvatar name={m.name} size={40} />
              <span className="fr-main">
                <span className="fr-name">{m.name.split(" ").slice(0, 2).join(" ")}</span>
                <span className="fr-sub">{m.count} {m.count === 1 ? "carro" : "carros"}</span>
                <span className="fr-bar" aria-hidden><span style={{ "--w": m.totalCents / topMech } as React.CSSProperties} /></span>
              </span>
              <span className="fr-value">{formatBRL(m.totalCents as Cents)}</span>
            </li>
          ))}
        </Box>

        <Box icon={<Medal size={22} weight="duotone" />} title="O que mais vende" hint="Quantas vezes foi feito e quanto deu no total." empty={!p.services.length && "Nenhum serviço pronto neste período."}>
          {p.services.map((s, i) => (
            <li key={s.label} className="fr-row" style={{ "--i": i } as React.CSSProperties}>
              <span className="fr-rank" aria-hidden>{i + 1}</span>
              <span className="fr-main">
                <span className="fr-name">{s.label}</span>
                <span className="fr-sub">{s.count === 1 ? "1 vez" : `${s.count} vezes`}</span>
              </span>
              <span className="fr-value">{formatBRL(s.totalCents)}</span>
            </li>
          ))}
        </Box>

        <Box icon={<ChatCircleText size={22} weight="duotone" />} title="Clientes para chamar de volta" hint="Não aparecem há mais de 6 meses. Toque em Chamar para mandar uma mensagem." tone="call" empty={!p.gone.length && "Nenhum cliente sumido. Ótimo sinal."}>
          {p.gone.map((c, i) => {
            const url = callBack(c.name, c.phone);
            return (
              <li key={c.customerId} className="fr-row" style={{ "--i": i } as React.CSSProperties}>
                <PersonAvatar name={c.name} size={40} />
                <span className="fr-main">
                  <span className="fr-name">{c.name.split(" ").slice(0, 2).join(" ")}</span>
                  <span className="fr-sub">Última vez há {monthsSince(c.lastDate)} meses</span>
                </span>
                {url && <a className="fr-call" href={url} target="_blank" rel="noreferrer" aria-label={`Chamar ${c.name} no WhatsApp`}><ChatCircleText size={18} weight="fill" aria-hidden /> Chamar</a>}
              </li>
            );
          })}
        </Box>

        <Box icon={<UsersThree size={22} weight="duotone" />} title="Clientes que mais voltam" hint="Quantas vezes vieram e quanto gastaram nos últimos 12 meses." empty={!p.loyal.length && "Ninguém voltou mais de uma vez ainda."}>
          {p.loyal.map((c, i) => (
            <li key={c.customerId} className="fr-row" style={{ "--i": i } as React.CSSProperties}>
              <PersonAvatar name={c.name} size={40} />
              <span className="fr-main">
                <span className="fr-name">{c.name.split(" ").slice(0, 2).join(" ")}</span>
                <span className="fr-sub">{c.visits} vezes</span>
              </span>
              <span className="fr-value">{formatBRL(c.totalCents)}</span>
            </li>
          ))}
        </Box>
      </div>

      {can("reports.view") && (
        <MoreDetails summary="Listas completas e planilhas">
          <ReportTables period={period} />
        </MoreDetails>
      )}
    </div>
  );
}

function Box({ icon, title, hint, tone, empty, children }: { icon: ReactNode; title: string; hint?: string; tone?: "call"; empty: false | string; children: ReactNode }) {
  return (
    <section className="fr-box" data-tone={tone}>
      <h2 className="fr-title"><span className="fr-icon" aria-hidden>{icon}</span>{title}</h2>
      {hint && <p className="fr-hint">{hint}</p>}
      {empty ? <p className="fr-empty">{empty}</p> : <ul className="fr-list">{children}</ul>}
    </section>
  );
}
