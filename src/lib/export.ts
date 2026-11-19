/**
 * Exportações reais em PDF (jsPDF) e Excel (ExcelJS), geradas no navegador.
 * As bibliotecas são carregadas sob demanda para não pesar no carregamento inicial.
 */
import type { Workbook } from "exceljs";
import type { ISODate } from "@/domain/types";
import { formatBRL, formatDate, formatDateTime } from "./format";

export type ColumnType = "text" | "money" | "date" | "number";

export interface ReportColumn {
  key: string;
  label: string;
  type: ColumnType;
  /** Largura no Excel (caracteres). */
  width?: number;
}

/** Texto, número (centavos em colunas "money") ou data AAAA-MM-DD. */
export type CellValue = string | number | null;

export interface ReportData {
  title: string;
  period?: { from: ISODate; to: ISODate };
  columns: ReportColumn[];
  rows: Record<string, CellValue>[];
  /** Totais por coluna (centavos para "money"). */
  totals?: Record<string, number>;
  /** Linhas de resumo exibidas antes da tabela. */
  summary?: { label: string; value: string }[];
}

export interface Branding {
  workshopName: string;
  logoDataUrl: string | null;
  primaryColor: string;
}

export function formatCell(value: CellValue, type: ColumnType): string {
  if (value === null || value === "") return "—";
  if (type === "money") return formatBRL(value as number);
  if (type === "date") return formatDate(value as string);
  return String(value);
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function fileName(title: string, ext: string): string {
  return `${slug(title)}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}

type JsPDF = import("jspdf").jsPDF;

/** Cabeçalho com logotipo, oficina e título. Retorna a posição Y seguinte. */
function pdfHeader(doc: JsPDF, branding: Branding, title: string, lines: string[]): number {
  const width = doc.internal.pageSize.getWidth();
  let x = 14;
  if (branding.logoDataUrl && /^data:image\/(png|jpeg)/.test(branding.logoDataUrl)) {
    try {
      doc.addImage(branding.logoDataUrl, 14, 10, 14, 14);
      x = 32;
    } catch {
      // Formato de imagem não suportado pelo PDF: segue sem logotipo.
    }
  }
  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(23, 32, 51);
  doc.text(branding.workshopName, x, 16);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(100, 116, 139);
  doc.text(title, x, 22);
  doc.setFontSize(8);
  lines.forEach((line, i) => doc.text(line, width - 14, 14 + i * 4, { align: "right" }));
  doc.setDrawColor(...hexToRgb(branding.primaryColor)).setLineWidth(0.6);
  doc.line(14, 28, width - 14, 28);
  return 34;
}

function pdfFooter(doc: JsPDF) {
  const pages = doc.getNumberOfPages();
  const { width, height } = doc.internal.pageSize;
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8).setTextColor(100, 116, 139);
    doc.text("GAVYO Auto", 14, height - 8);
    doc.text(`Página ${i} de ${pages}`, width - 14, height - 8, { align: "right" });
  }
}

export async function exportReportPdf(report: ReportData, branding: Branding): Promise<void> {
  (await buildReportPdf(report, branding)).save(fileName(report.title, "pdf"));
}

/** Monta o PDF sem salvar (usado também nos testes automatizados). */
export async function buildReportPdf(report: ReportData, branding: Branding): Promise<JsPDF> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: report.columns.length > 6 ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const info = [`Gerado em ${formatDateTime(new Date().toISOString())}`];
  if (report.period) info.push(`Período: ${formatDate(report.period.from)} a ${formatDate(report.period.to)}`);
  info.push(`${report.rows.length} ${report.rows.length === 1 ? "registro" : "registros"}`);
  let y = pdfHeader(doc, branding, report.title, info);

  if (report.summary?.length) {
    doc.setFontSize(9).setTextColor(23, 32, 51);
    report.summary.forEach((s, i) => {
      doc.setFont("helvetica", "normal").text(`${s.label}:`, 14, y + i * 5);
      doc.setFont("helvetica", "bold").text(s.value, 70, y + i * 5);
    });
    y += report.summary.length * 5 + 3;
  }

  const numeric = (c: ReportColumn) => c.type === "money" || c.type === "number";
  autoTable(doc, {
    startY: y,
    head: [report.columns.map((c) => c.label)],
    body: report.rows.map((r) => report.columns.map((c) => formatCell(r[c.key] ?? null, c.type))),
    foot: report.totals
      ? [report.columns.map((c, i) => (c.key in report.totals! ? formatCell(report.totals![c.key], c.type) : i === 0 ? "Total" : ""))]
      : undefined,
    styles: { fontSize: 8, cellPadding: 1.8, textColor: [23, 32, 51] },
    headStyles: { fillColor: hexToRgb(branding.primaryColor), textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [241, 245, 249], textColor: [23, 32, 51], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: Object.fromEntries(report.columns.map((c, i) => [i, { halign: numeric(c) ? "right" : "left" }])),
    margin: { left: 14, right: 14, bottom: 14 },
    showFoot: "lastPage",
  });
  pdfFooter(doc);
  return doc;
}

export async function exportReportXlsx(report: ReportData, branding: Branding): Promise<void> {
  const buffer = await buildReportXlsx(report, branding);
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName(report.title, "xlsx");
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Monta a planilha .xlsx em memória (usado também nos testes automatizados). */
export async function buildReportXlsx(report: ReportData, branding: Branding): Promise<ArrayBuffer> {
  return buildWorkbookXlsx([report], branding);
}

/** Várias listas num arquivo só, uma aba para cada ("Mandar para o contador", decisão 77). */
export async function buildWorkbookXlsx(reports: ReportData[], branding: Branding): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GAVYO Auto";
  workbook.created = new Date();
  for (const report of reports) addReportSheet(workbook, report, branding);
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

export async function exportWorkbookXlsx(reports: ReportData[], branding: Branding, title: string): Promise<void> {
  const buffer = await buildWorkbookXlsx(reports, branding);
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName(title, "xlsx");
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function addReportSheet(workbook: Workbook, report: ReportData, branding: Branding) {
  const sheet = workbook.addWorksheet(report.title.slice(0, 31));

  sheet.addRow([branding.workshopName]).font = { bold: true, size: 13 };
  sheet.addRow([report.title]).font = { bold: true };
  if (report.period) sheet.addRow([`Período: ${formatDate(report.period.from)} a ${formatDate(report.period.to)}`]);
  sheet.addRow([`Gerado em ${formatDateTime(new Date().toISOString())}`]);
  sheet.addRow([]);

  const header = sheet.addRow(report.columns.map((c) => c.label));
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${branding.primaryColor.slice(1).toUpperCase()}` } };
  });
  sheet.views = [{ state: "frozen", ySplit: header.number }];

  const toExcel = (value: CellValue, type: ColumnType) => {
    if (value === null || value === "") return null;
    if (type === "money") return (value as number) / 100;
    if (type === "date") {
      const [y, m, d] = (value as string).slice(0, 10).split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, d));
    }
    return value;
  };

  for (const r of report.rows) sheet.addRow(report.columns.map((c) => toExcel(r[c.key] ?? null, c.type)));
  if (report.totals) {
    const total = sheet.addRow(
      report.columns.map((c, i) => (c.key in report.totals! ? toExcel(report.totals![c.key], c.type) : i === 0 ? "Total" : null)),
    );
    total.font = { bold: true };
  }

  report.columns.forEach((c, i) => {
    const col = sheet.getColumn(i + 1);
    col.width = c.width ?? (c.type === "text" ? 28 : 15);
    if (c.type === "money") col.numFmt = '"R$" #,##0.00';
    if (c.type === "date") col.numFmt = "dd/mm/yyyy";
    if (c.type !== "text") col.alignment = { horizontal: "right" };
  });
  // Os títulos ficam na coluna A; mantém-nos alinhados à esquerda.
  for (let i = 1; i < header.number; i++) sheet.getRow(i).getCell(1).alignment = { horizontal: "left" };

}

export interface OrderDocument {
  number: string;
  /** "Orçamento" enquanto aberto sem pagamento; "Serviço" caso contrário. */
  kind: string;
  status: string;
  payment: string;
  openedAt: string;
  customer: string;
  phone: string;
  vehicle: string;
  plate: string;
  mileage: string;
  mechanic: string;
  description: string;
  notes: string;
  items: { name: string; quantity: number; unit: string; subtotal: string }[];
  labor: string;
  parts: string;
  total: string;
}

export async function exportOrderPdf(order: OrderDocument, branding: Branding): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = pdfHeader(doc, branding, order.kind === "Serviço" ? order.number : `${order.kind} · ${order.number}`, [
    `Gerado em ${formatDateTime(new Date().toISOString())}`,
    `Abertura: ${order.openedAt}`,
    `Etapa: ${order.status}`,
  ]);

  const pairs: [string, string][] = [
    ["Cliente", order.customer],
    ["Telefone", order.phone],
    ["Veículo", order.vehicle],
    ["Placa", order.plate],
    ["Quilometragem", order.mileage],
    ["Responsável", order.mechanic],
    ["Pagamento", order.payment],
  ];
  doc.setFontSize(9).setTextColor(23, 32, 51);
  pairs.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    doc.setFont("helvetica", "bold").text(`${label}:`, 14 + col * 95, y + row * 5.5);
    doc.setFont("helvetica", "normal").text(value || "—", 42 + col * 95, y + row * 5.5);
  });
  y += Math.ceil(pairs.length / 2) * 5.5 + 4;

  doc.setFont("helvetica", "bold").text("Serviço", 14, y);
  doc.setFont("helvetica", "normal");
  const desc = doc.splitTextToSize(order.description + (order.notes ? `\nObservações: ${order.notes}` : ""), 182);
  doc.text(desc, 14, y + 5);
  y += 5 + desc.length * 4.2 + 3;

  autoTable(doc, {
    startY: y,
    head: [["Peça", "Qtd.", "Preço unit.", "Subtotal"]],
    body: order.items.length
      ? order.items.map((i) => [i.name, String(i.quantity), i.unit, i.subtotal])
      : [["Nenhuma peça utilizada", "", "", ""]],
    styles: { fontSize: 9, cellPadding: 2, textColor: [23, 32, 51] },
    headStyles: { fillColor: hexToRgb(branding.primaryColor), textColor: 255 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    margin: { left: 14, right: 14 },
  });
  const end = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  const right = doc.internal.pageSize.getWidth() - 14;
  const totals: [string, string, boolean][] = [
    ["Mão de obra", order.labor, false],
    ["Peças", order.parts, false],
    ["Total", order.total, true],
  ];
  totals.forEach(([label, value, bold], i) => {
    doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(bold ? 11 : 9);
    doc.text(label, right - 60, end + i * 6);
    doc.text(value, right, end + i * 6, { align: "right" });
  });
  pdfFooter(doc);
  doc.save(`${slug(`${order.kind}-${order.number}`)}.pdf`);
}
