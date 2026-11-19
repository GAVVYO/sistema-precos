"use client";

import { useEffect, useRef, useState } from "react";
import { motionReduced } from "@/lib/view-transition";

/**
 * Rasante do gavião (decisão 72): ao entrar com o PIN certo, o gavião mergulha
 * do alto à direita em curva pela tela, puxando uma cortina azul da GAVYO; com a
 * tela coberta o sistema troca de página por baixo, e a cortina segue para a
 * esquerda revelando o Início. Montado no layout raiz para sobreviver à troca de rota.
 * Momento raro (uma vez por entrada): aqui cabe o capricho. Movimento reduzido: só esmaece.
 */

type Job = { go: () => void };
let start: ((job: Job) => void) | null = null;

/** Dispara o rasante; `go` troca de página quando a cortina cobre a tela. */
export function playSwoop(go: () => void) {
  if (!start || motionReduced()) return go();
  start({ go });
}

const COVER = 820; // mergulho até cobrir
const REVEAL = 520; // cortina saindo

export function SwoopHost() {
  const [job, setJob] = useState<Job | null>(null);
  const eagle = useRef<HTMLImageElement>(null);
  const curtain = useRef<HTMLDivElement>(null);

  useEffect(() => {
    start = (j) => setJob(j);
    return () => { start = null; };
  }, []);

  useEffect(() => {
    if (!job || !eagle.current || !curtain.current) return;
    const el = eagle.current;
    const cur = curtain.current;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const size = Math.min(Math.max(w * 0.3, 200), 460);
    el.style.width = `${size}px`;
    // Curva do mergulho (Bézier cúbica): entra no alto à direita, desce quase até o chão e sobe saindo pela esquerda.
    const P = [[w + size * 0.6, -size * 0.5], [w * 0.7, h * 0.95], [w * 0.25, h * 0.95], [-size * 0.9, h * 0.18]];
    const at = (t: number) => {
      const u = 1 - t;
      const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
      return [0, 1].map((i) => k[0] * P[0][i] + k[1] * P[1][i] + k[2] * P[2][i] + k[3] * P[3][i]);
    };
    // Curva de velocidade: acelera no mergulho, mantém no rasante.
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    let alive = true;
    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      if (!alive) return;
      const t = Math.min(1, (now - t0) / COVER);
      const e = ease(t);
      const [x, y] = at(e);
      const [nx, ny] = at(Math.min(1, e + 0.01));
      const angle = (Math.atan2(ny - y, nx - x) * 180) / Math.PI + 180; // bico na direção do voo
      el.style.transform = `translate(${x - size / 2}px, ${y - size * 0.32}px) rotate(${angle}deg) scaleX(-1)`;
      // A cortina vem colada atrás do gavião (a borda dela é a cauda dele).
      cur.style.clipPath = `inset(0 0 0 ${Math.max(0, x + size * 0.15)}px)`;
      if (t < 1) { raf = requestAnimationFrame(frame); return; }
      cur.style.clipPath = "inset(0 0 0 0)";
      el.style.opacity = "0";
      reveal();
    };
    const reveal = async () => {
      const from = location.pathname;
      job.go();
      // Só abre a cortina quando a página nova já está montada por baixo (até 2 s).
      for (let i = 0; i < 40 && location.pathname === from; i++) await new Promise((r) => setTimeout(r, 50));
      await new Promise((r) => setTimeout(r, 160));
      if (!alive) return;
      const anim = cur.animate(
        [{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(0 100% 0 0)" }],
        { duration: REVEAL, easing: "cubic-bezier(.65, 0, .35, 1)", fill: "forwards" },
      );
      await anim.finished;
      if (alive) setJob(null);
    };
    raf = requestAnimationFrame(frame);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [job]);

  if (!job) return null;
  return (
    <div className="swoop" aria-hidden>
      <div ref={curtain} className="swoop-curtain">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/gavyo-nome.png" alt="" className="swoop-word" />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={eagle} src="/brand/gavyo-aguia.png" alt="" className="swoop-eagle" />
    </div>
  );
}
