/**
 * O recorte do tour acompanha o alvo sem laço eterno: só mede quando há
 * rolagem, redimensionamento ou o alvo muda de tamanho — no máximo 1× por quadro.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { followBox } from "@/lib/follow-box";

type Fn = () => void;
let listeners: Map<string, Set<Fn>>;
let frames: Fn[];
let observers: { cb: Fn; disconnected: boolean; observed: unknown[] }[];

const fire = (type: string) => listeners.get(type)?.forEach((f) => f());
const nextFrame = () => { const q = frames; frames = []; q.forEach((f) => f()); };

beforeEach(() => {
  listeners = new Map();
  frames = [];
  observers = [];
  vi.stubGlobal("window", {
    addEventListener: (t: string, f: Fn) => { if (!listeners.has(t)) listeners.set(t, new Set()); listeners.get(t)!.add(f); },
    removeEventListener: (t: string, f: Fn) => listeners.get(t)?.delete(f),
  });
  vi.stubGlobal("requestAnimationFrame", (f: Fn) => { frames.push(f); return frames.length; });
  vi.stubGlobal("cancelAnimationFrame", () => { frames = []; });
  vi.stubGlobal("ResizeObserver", class {
    o: { cb: Fn; disconnected: boolean; observed: unknown[] };
    constructor(cb: Fn) { this.o = { cb, disconnected: false, observed: [] }; observers.push(this.o); }
    observe(el: unknown) { this.o.observed.push(el); }
    disconnect() { this.o.disconnected = true; }
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("followBox", () => {
  const el = { getBoundingClientRect: () => ({ top: 1, left: 2, width: 3, height: 4 }) } as unknown as Element;

  it("avisa na hora ao ligar", () => {
    const seen: DOMRect[] = [];
    followBox(el, (r) => seen.push(r));
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ top: 1, left: 2, width: 3, height: 4 });
  });

  it("junta vários eventos no mesmo quadro e não roda sem evento", () => {
    const onChange = vi.fn();
    followBox(el, onChange);
    nextFrame();
    expect(onChange).toHaveBeenCalledTimes(1); // nenhum laço: sem evento, nada acontece
    fire("scroll"); fire("scroll"); fire("resize");
    observers[0].cb();
    nextFrame();
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("observa o alvo e desliga tudo", () => {
    const onChange = vi.fn();
    const off = followBox(el, onChange);
    expect(observers[0].observed).toEqual([el]);
    off();
    expect(observers[0].disconnected).toBe(true);
    fire("scroll"); fire("resize");
    nextFrame();
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
