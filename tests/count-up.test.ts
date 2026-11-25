import { describe, expect, it } from "vitest";
import { countFrames } from "@/components/ui/count-up";

describe("CountUp: passo do contador", () => {
  it("conta com saída cúbica e termina exatamente no valor final", () => {
    const step = countFrames(0, 100, 650, String);
    expect(step(0)).toEqual({ text: "0", done: false });
    expect(step(325).text).toBe("88"); // 1 - (0,5)^3 = 0,875 → 87,5 → 88
    expect(step(650)).toEqual({ text: "100", done: true });
    expect(step(9999)).toEqual({ text: "100", done: true });
  });

  it("conta para baixo e usa o formato (reais)", () => {
    const step = countFrames(1000, 0, 650, (n) => `R$ ${n}`);
    expect(step(0).text).toBe("R$ 1000");
    expect(step(650)).toEqual({ text: "R$ 0", done: true });
  });
});
