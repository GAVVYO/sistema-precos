import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildSeed, DEMO_WORKSHOP_ID, SECOND_WORKSHOP_ID } from "@/demo/seed";
import { buildReportPdf, buildReportXlsx } from "@/lib/export";
import { addDays, todayISO } from "@/lib/format";
import { scopeTo } from "@/services/core";
import { financeSummary } from "@/services/finance";
import { buildReport, ReportFilters, REPORTS } from "@/services/reports";

const NOW = new Date("2026-11-16T15:00:00.000Z");
const db = buildSeed(NOW);
const today = todayISO(NOW);
const filters: ReportFilters = { from: addDays(today, -30), to: today, option: "", mechanicId: "", text: "" };
const branding = { workshopName: "Oficina Modelo Passaré", logoDataUrl: null, primaryColor: "#2563EB" };

describe("relatórios", () => {
  it("todos os relatórios são gerados com colunas e linhas coerentes", () => {
    const view = scopeTo(db, DEMO_WORKSHOP_ID);
    for (const info of REPORTS) {
      const report = buildReport(view, info.kind, filters);
      expect(report.rows.length).toBeGreaterThan(0);
      for (const row of report.rows) {
        for (const column of report.columns) expect(row).toHaveProperty(column.key);
      }
    }
  });

  it("o relatório financeiro bate com o resumo do módulo financeiro", () => {
    const view = scopeTo(db, DEMO_WORKSHOP_ID);
    const report = buildReport(view, "finance", filters);
    const summary = financeSummary(view, filters.from, filters.to);
    expect(report.totals?.income).toBe(summary.receivedCents);
    expect(report.totals?.expense).toBe(summary.expensesCents);
  });

  it("respeita filtros e o isolamento entre oficinas", () => {
    const mine = buildReport(scopeTo(db, DEMO_WORKSHOP_ID), "orders", filters);
    const other = buildReport(scopeTo(db, SECOND_WORKSHOP_ID), "orders", filters);
    expect(mine.rows).toHaveLength(11);
    expect(other.rows).toHaveLength(3);
    expect(mine.rows.some((r) => r.customer === "Edilson Monteiro Braga")).toBe(false);
    const done = buildReport(scopeTo(db, DEMO_WORKSHOP_ID), "orders", { ...filters, option: "done" });
    expect(done.rows.every((r) => r.status === "Concluído")).toBe(true);
    const cancelled = buildReport(scopeTo(db, DEMO_WORKSHOP_ID), "orders", { ...filters, option: "cancelled" });
    expect(cancelled.rows).toHaveLength(1);
    const byPlate = buildReport(scopeTo(db, DEMO_WORKSHOP_ID), "history", { ...filters, text: "hxa-4b21" });
    expect(byPlate.rows).toHaveLength(1);
  });
});

describe("exportações", () => {
  const report = buildReport(scopeTo(db, DEMO_WORKSHOP_ID), "orders", filters);

  it("gera Excel com datas e valores em tipos numéricos", async () => {
    const buffer = await buildReportXlsx(report, branding);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    expect(sheet.getCell("A1").value).toBe("Oficina Modelo Passaré");
    let headerRow = 0;
    sheet.eachRow((row, n) => {
      if (row.getCell(1).value === "OS") headerRow = n;
    });
    expect(headerRow).toBeGreaterThan(0);
    const first = sheet.getRow(headerRow + 1);
    expect(first.getCell(1).value).toBe("OS-0001");
    expect(first.getCell(2).value).toBeInstanceOf(Date);
    expect(first.getCell(12).value).toBe(212);
    expect(sheet.getColumn(12).numFmt).toContain("#,##0.00");
    const total = sheet.getRow(headerRow + 1 + report.rows.length);
    expect(total.getCell(1).value).toBe("Total");
    expect(total.getCell(12).value).toBe(report.totals!.total / 100);
  });

  it("gera PDF válido com cabeçalho da oficina", async () => {
    const doc = await buildReportPdf(report, branding);
    const bytes = new Uint8Array(doc.output("arraybuffer"));
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(3000);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});
