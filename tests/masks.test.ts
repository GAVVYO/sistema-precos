import { describe, expect, it } from "vitest";
import { normalizePhone, normalizePlate, parseBRL } from "@/lib/format";
import { maskDigits, maskEmail, maskMoney, maskPhone, maskPlate } from "@/lib/masks";

describe("máscaras", () => {
  it("telefone celular, fixo, colado com +55 e parcial", () => {
    expect(maskPhone("85988887777")).toBe("(85) 98888-7777");
    expect(maskPhone("8533334444")).toBe("(85) 3333-4444");
    expect(maskPhone("+55 85 98888-7777")).toBe("(85) 98888-7777");
    expect(maskPhone("859")).toBe("(85) 9");
    expect(maskPhone("8")).toBe("(8");
    expect(maskPhone("")).toBe("");
    expect(normalizePhone(maskPhone("85988887777"))).toBe("85988887777");
  });
  it("placa Mercosul e antiga, ignorando o que não cabe na posição", () => {
    expect(maskPlate("abc1d23")).toBe("ABC1D23");
    expect(maskPlate("hwk-9321")).toBe("HWK9321");
    expect(maskPlate("AB1C")).toBe("ABC");
    expect(maskPlate("ABC1D234")).toBe("ABC1D23");
    expect(normalizePlate(maskPlate("qrt 4j58"))).toBe("QRT4J58");
  });
  it("dinheiro: 150 é cento e cinquenta, milhar e centavos", () => {
    expect(maskMoney("150")).toBe("150");
    expect(maskMoney("1500")).toBe("1.500");
    expect(maskMoney("1500,5")).toBe("1.500,5");
    expect(maskMoney("1.500,555")).toBe("1.500,55");
    expect(maskMoney(",5")).toBe("0,5");
    expect(maskMoney("R$ 007")).toBe("7");
    expect(parseBRL(maskMoney("1234567,89"))).toBe(123456789);
    expect(parseBRL(maskMoney("150"))).toBe(15000);
  });
  it("números e e-mail", () => {
    expect(maskDigits("171.500 km", 7)).toBe("171500");
    expect(maskDigits("20199", 4)).toBe("2019");
    expect(maskEmail(" Joao@Oficina.com ")).toBe("joao@oficina.com");
  });
});
