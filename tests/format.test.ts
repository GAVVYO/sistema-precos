import { describe, expect, it } from "vitest";
import {
  addDays, dateOf, endOfMonth, formatBRL, formatDate, formatPhone, formatPlate,
  normalizePhone, normalizePlate, parseBRL, startOfWeek,
} from "@/lib/format";
import { buildWhatsAppUrl, quoteMessage } from "@/lib/whatsapp";

describe("valores monetários em centavos", () => {
  it("interpreta entradas em formato brasileiro", () => {
    expect(parseBRL("150")).toBe(15000);
    expect(parseBRL("150,5")).toBe(15050);
    expect(parseBRL("1.234,56")).toBe(123456);
    expect(parseBRL("R$ 89,90")).toBe(8990);
    expect(parseBRL("0")).toBe(0);
    expect(parseBRL("")).toBeNull();
    expect(parseBRL("abc")).toBeNull();
    expect(parseBRL("-5")).toBeNull();
  });
  it("formata em reais", () => {
    expect(formatBRL(123456).replace(/\s/g, " ")).toBe("R$ 1.234,56");
  });
});

describe("datas no fuso de Fortaleza", () => {
  it("usa a data local, não a UTC", () => {
    expect(dateOf("2026-11-17T01:30:00.000Z")).toBe("2026-11-16");
    expect(formatDate("2026-11-16")).toBe("16/11/2026");
  });
  it("calcula intervalos", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(startOfWeek("2026-11-18")).toBe("2026-11-15");
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
  });
});

describe("telefone e placa", () => {
  it("normaliza e valida telefone brasileiro", () => {
    expect(normalizePhone("(85) 98765-4321")).toBe("85987654321");
    expect(normalizePhone("+55 85 98765-4321")).toBe("85987654321");
    expect(normalizePhone("85 3234-5678")).toBe("8532345678");
    expect(normalizePhone("98765-4321")).toBeNull();
    expect(normalizePhone("85 88765-4321")).toBeNull();
    expect(formatPhone("85987654321")).toBe("(85) 98765-4321");
  });
  it("aceita placa antiga e Mercosul", () => {
    expect(normalizePlate("abc-1234")).toBe("ABC1234");
    expect(normalizePlate("abc1d23")).toBe("ABC1D23");
    expect(normalizePlate("AB1234")).toBeNull();
    expect(formatPlate("ABC1234")).toBe("ABC-1234");
  });
});

describe("WhatsApp", () => {
  it("gera link oficial com DDI 55 e texto codificado", () => {
    const url = buildWhatsAppUrl("(85) 98765-4321", "Olá, Maria!\nTotal: R$ 10,00");
    expect(url).toBe("https://wa.me/5585987654321?text=Ol%C3%A1%2C%20Maria!%0ATotal%3A%20R%24%2010%2C00");
    expect(buildWhatsAppUrl("123", "x")).toBeNull();
  });
  it("monta o orçamento com mão de obra, peças e total", () => {
    const text = quoteMessage({
      customerName: "Maria", workshopName: "Oficina Modelo Passaré", vehicle: "Fiat Uno", plate: "HXA4B21",
      description: "Troca de óleo", laborCents: 6000, partsCents: 15200, totalCents: 21200,
    });
    for (const piece of ["Maria", "Oficina Modelo Passaré", "Fiat Uno", "HXA4B21", "Troca de óleo", "60,00", "152,00", "212,00"]) {
      expect(text).toContain(piece);
    }
  });
});
