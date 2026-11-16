"use client";

import { FileSpreadsheet, FileText, SearchX } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/app-state/app-context";
import { PeriodPicker, usePeriod } from "@/components/ui/period";
import { Button, Card, CardHeader, cx, EmptyState, Input, PageHeader, Select } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { MOVEMENT_TYPE_LABELS, ORDER_STATUS_LABELS } from "@/domain/labels";
import { exportReportPdf, exportReportXlsx, formatCell } from "@/lib/export";
import { buildReport, ReportKind, REPORTS } from "@/services/reports";

const OPTIONS: Partial<Record<ReportKind, { label: string; all: string; items: [string, string][] }>> = {
  orders: { label: "Status", all: "Todos os status", items: [...Object.entries(ORDER_STATUS_LABELS), ["cancelled", "Cancelada"]] as [string, string][] },
  finance: { label: "Tipo", all: "Receitas e despesas", items: [["income", "Somente receitas"], ["expense", "Somente despesas"]] },
  stock: { label: "Situação", all: "Todas as situações", items: [["ok", "Normal"], ["low", "Estoque baixo"], ["out", "Sem estoque"]] },
  stock_moves: { label: "Tipo", all: "Todos os tipos", items: Object.entries(MOVEMENT_TYPE_LABELS) },
};

const PREVIEW_LIMIT = 200;

export function ReportsPage() {
  const { view, can, settings, mechanics } = useApp();
  // Somente relatórios que o usuário pode consultar.
  const available = REPORTS.filter((r) => can(r.permission));
  const [kind, setKind] = useState<ReportKind | null>(available[0]?.kind ?? null);
  const [period, setPeriod] = usePeriod("30");
  const [option, setOption] = useState("");
  const [mechanicId, setMechanicId] = useState("");
  const [text, setText] = useState("");
  const [exporting, setExporting] = useState<null | "pdf" | "xlsx">(null);

  const info = available.find((r) => r.kind === kind) ?? null;
  const report = info ? buildReport(view, info.kind, { from: period.from, to: period.to, option, mechanicId, text }) : null;

  if (!info || !report) {
    return (
      <Card>
        <EmptyState title="Nenhum relatório disponível" description="Seu usuário não tem permissão para consultar os dados dos relatórios." />
      </Card>
    );
  }

  const branding = { workshopName: settings.displayName, logoDataUrl: settings.logoDataUrl, primaryColor: settings.primaryColor };
  const run = async (format: "pdf" | "xlsx") => {
    setExporting(format);
    try {
      await (format === "pdf" ? exportReportPdf(report, branding) : exportReportXlsx(report, branding));
      toast("success", `${format === "pdf" ? "PDF" : "Planilha Excel"} gerado com ${report.rows.length} ${report.rows.length === 1 ? "registro" : "registros"}.`);
    } catch (e) {
      console.error(e);
      toast("error", "Não foi possível gerar o arquivo. Tente novamente.");
    }
    setExporting(null);
  };
  const opt = OPTIONS[info.kind];
  const canExport = can("reports.export");

  return (
    <div className="module-page module-reports">
      <PageHeader title="Relatórios" description="Consulte, filtre e exporte os registros da oficina em PDF ou Excel." />
      <div className="report-layout grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <Card className="self-start">
          <CardHeader title="Tipo de relatório" />
          <div role="group" aria-label="Tipo de relatório" className="p-1.5">
            {available.map((r) => (
              <button
                key={r.kind}
                type="button"
                aria-pressed={r.kind === info.kind}
                onClick={() => { setKind(r.kind); setOption(""); setMechanicId(""); setText(""); }}
                className={cx("block w-full rounded-md px-3 py-2 text-left", r.kind === info.kind ? "bg-primary-soft" : "hover:bg-slate-50")}
              >
                <span className={cx("block text-sm font-semibold", r.kind === info.kind && "text-primary")}>{r.label}</span>
                <span className="block text-xs text-muted">{r.description}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="min-w-0">
          <CardHeader
            title={report.title}
            subtitle={`${report.rows.length} ${report.rows.length === 1 ? "registro" : "registros"} com os filtros atuais`}
            actions={
              canExport ? (
                <>
                  <Button icon={<FileText className="size-4" aria-hidden />} loading={exporting === "pdf"} disabled={report.rows.length === 0 || exporting !== null} onClick={() => run("pdf")}>Exportar PDF</Button>
                  <Button icon={<FileSpreadsheet className="size-4" aria-hidden />} loading={exporting === "xlsx"} disabled={report.rows.length === 0 || exporting !== null} onClick={() => run("xlsx")}>Exportar Excel</Button>
                </>
              ) : (
                <span className="text-xs text-muted">Seu usuário pode consultar, mas não exportar.</span>
              )
            }
          />
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            {info.usesPeriod && <PeriodPicker value={period} onChange={setPeriod} />}
            {opt && (
              <Select className="w-52" aria-label={opt.label} value={option} onChange={(e) => setOption(e.target.value)}>
                <option value="">{opt.all}</option>
                {opt.items.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            )}
            {info.kind === "orders" && (
              <Select className="w-56" aria-label="Responsável" value={mechanicId} onChange={(e) => setMechanicId(e.target.value)}>
                <option value="">Todos os responsáveis</option>
                {mechanics.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            )}
            {info.kind === "history" && <Input className="w-72" aria-label="Buscar no histórico" placeholder="Filtrar por placa, cliente ou veículo" value={text} onChange={(e) => setText(e.target.value)} />}
            {!info.usesPeriod && !opt && <span className="text-xs text-muted">Posição atual — este relatório não depende de período.</span>}
          </div>

          {report.summary && (
            <dl className="flex flex-wrap gap-x-8 gap-y-1 border-b border-line px-4 py-2 text-sm">
              {report.summary.map((s) => (
                <div key={s.label} className="flex gap-2"><dt className="text-muted">{s.label}:</dt><dd className="font-semibold">{s.value}</dd></div>
              ))}
            </dl>
          )}

          {report.rows.length === 0 ? (
            <EmptyState icon={<SearchX className="size-8" aria-hidden />} title="Nenhum registro encontrado" description="Ajuste o período ou os filtros para ver resultados." />
          ) : (
            <div className="max-h-[calc(100vh-390px)] overflow-auto">
              <table tabIndex={0} aria-label={report.title} className="data-table">
                <thead className="sticky top-0">
                  <tr>{report.columns.map((c) => <th key={c.key} className={c.type === "money" || c.type === "number" ? "num" : undefined}>{c.label}</th>)}</tr>
                </thead>
                <tbody>
                  {report.rows.slice(0, PREVIEW_LIMIT).map((r, i) => (
                    <tr key={i}>
                      {report.columns.map((c) => (
                        <td key={c.key} className={c.type === "money" || c.type === "number" ? "num" : c.key === "service" || c.key === "parts" || c.key === "reason" || c.key === "description" ? "min-w-48" : "whitespace-nowrap"}>
                          {formatCell(r[c.key] ?? null, c.type)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {report.totals && (
                  <tfoot>
                    <tr className="bg-slate-50 font-semibold">
                      {report.columns.map((c, i) => (
                        <td key={c.key} className={c.type === "money" || c.type === "number" ? "num" : undefined}>
                          {c.key in report.totals! ? formatCell(report.totals![c.key], c.type) : i === 0 ? "Total" : ""}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
              {report.rows.length > PREVIEW_LIMIT && (
                <p className="border-t border-line px-4 py-2 text-xs text-muted">Exibindo os primeiros {PREVIEW_LIMIT} registros. A exportação inclui todos os {report.rows.length}.</p>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
