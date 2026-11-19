"use client";

import { ArrowLeft, Backspace, Buildings } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDemoState } from "@/app-state/app-context";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Skeleton } from "@/components/ui/primitives";
import { demoStore } from "@/demo/store";
import { ROLE_LABELS } from "@/domain/permissions";
import type { ID } from "@/domain/types";
import { usePref } from "@/lib/prefs";
import { motionReduced } from "@/lib/view-transition";
import { DEMO_PIN, verifyPin } from "@/services/admin";

/**
 * Tela de entrada (decisão 70): central e limpa, a águia pousa ao lado do nome
 * GAVYO; cada funcionário toca no próprio nome e digita o PIN de 4 números
 * (como as maquininhas Square/Toast). 5 erros travam 30 s.
 */

const MAX_TRIES = 5;
const LOCK_MS = 30_000;

function Logo({ flap }: { flap: boolean }) {
  return (
    <div className="login-logo" role="img" aria-label="GAVYO">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/gavyo-nome.png" alt="" className="login-logo-name" width={1030} height={278} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/gavyo-aguia.png" alt="" className="login-logo-eagle" data-flap={flap || undefined} width={437} height={284} />
    </div>
  );
}

export function PinLogin() {
  const state = useDemoState();
  const router = useRouter();
  const db = state?.db;
  const [deviceWs, setDeviceWs] = usePref<string>("device-workshop", "");
  const [choosingWs, setChoosingWs] = useState(false);
  const [userId, setUserId] = useState<ID | null>(null);
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(0);
  const [ok, setOk] = useState(false);
  const [tries, setTries] = useState<Record<string, { n: number; until: number }>>({});
  const [now, setNow] = useState(() => Date.now());
  const pinTitle = useRef<HTMLHeadingElement>(null);

  const workshopId = db?.workshops.some((w) => w.id === deviceWs) ? deviceWs : db?.workshops[0]?.id ?? "";
  const settings = db?.settings.find((s) => s.workshopId === workshopId);
  const members = (db?.memberships.filter((m) => m.workshopId === workshopId && m.active) ?? [])
    .map((m) => ({ m, u: db!.users.find((x) => x.id === m.userId)! }))
    .sort((a, b) => a.u.name.localeCompare(b.u.name, "pt-BR"));
  const person = members.find((x) => x.u.id === userId);
  const lock = userId ? tries[userId] : undefined;
  const lockedFor = lock && lock.until > now ? Math.ceil((lock.until - now) / 1000) : 0;

  useEffect(() => {
    if (!lockedFor) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [lockedFor]);

  const submit = useCallback((value: string) => {
    if (!db || !userId) return;
    if (verifyPin(db, workshopId, userId, value)) {
      setOk(true);
      demoStore.login(workshopId, userId);
      window.setTimeout(() => router.replace("/inicio"), motionReduced() ? 0 : 650);
      return;
    }
    const n = (tries[userId]?.n ?? 0) + 1;
    setTries({ ...tries, [userId]: { n: n >= MAX_TRIES ? 0 : n, until: n >= MAX_TRIES ? Date.now() + LOCK_MS : 0 } });
    setNow(Date.now());
    setShake((x) => x + 1);
    window.setTimeout(() => setPin(""), 380);
  }, [db, router, tries, userId, workshopId]);

  const press = useCallback((d: string) => {
    if (ok || lockedFor) return;
    setPin((p) => {
      if (p.length >= 4) return p;
      const next = p + d;
      if (next.length === 4) window.setTimeout(() => submit(next), 120);
      return next;
    });
  }, [lockedFor, ok, submit]);
  const back = useCallback(() => setPin((p) => p.slice(0, -1)), []);

  // Teclado físico: números, apagar e Esc (volta para a lista de pessoas).
  useEffect(() => {
    if (!userId) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (e.key === "Backspace") { e.preventDefault(); back(); }
      else if (e.key === "Escape") { setUserId(null); setPin(""); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back, press, userId]);

  useEffect(() => { if (userId) pinTitle.current?.focus(); }, [userId]);

  if (!db) {
    return <main className="login-screen"><div className="login-card" aria-busy="true"><Skeleton className="h-10" /><Skeleton className="h-40" /></div></main>;
  }

  return (
    <main className="login-screen">
      <div className="login-stack">
        <Logo flap={ok} />

        <section className="login-card" aria-live="polite">
          {choosingWs ? (
            <>
              <h1 className="login-title">Qual oficina usa este computador?</h1>
              <p className="login-sub">Na versão real, o dono entra uma vez com e-mail e senha para conectar o aparelho.</p>
              <div className="login-shops">
                {db.workshops.map((w) => {
                  const st = db.settings.find((s) => s.workshopId === w.id);
                  return (
                    <button key={w.id} type="button" className="login-shop" aria-pressed={w.id === workshopId} onClick={() => { setDeviceWs(w.id); setChoosingWs(false); setUserId(null); }}>
                      <Buildings size={24} weight="duotone" aria-hidden />
                      <span>{st?.displayName ?? w.name}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : !person ? (
            <>
              <h1 className="login-title">Quem está entrando?</h1>
              <p className="login-sub">{settings?.displayName} · <button type="button" className="login-link" onClick={() => setChoosingWs(true)}>Trocar de oficina</button></p>
              <ul className="login-people">
                {members.map(({ m, u }) => (
                  <li key={m.id}>
                    <button type="button" className="login-person" onClick={() => { setUserId(u.id); setPin(""); setOk(false); }}>
                      <PersonAvatar name={u.name} photo={u.photo} size={64} />
                      <span className="login-person-name">{u.name.split(" ").slice(0, 2).join(" ")}</span>
                      <span className="login-person-role">{ROLE_LABELS[m.role]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="login-pin">
              <button type="button" className="login-back" onClick={() => { setUserId(null); setPin(""); }}>
                <ArrowLeft size={18} weight="bold" aria-hidden /> Não é você?
              </button>
              <PersonAvatar name={person.u.name} photo={person.u.photo} size={72} />
              <h1 className="login-title" tabIndex={-1} ref={pinTitle}>Olá, {person.u.name.split(" ")[0]}. Digite seu PIN</h1>
              <div key={shake} className="login-dots" data-shake={shake ? true : undefined} data-ok={ok || undefined} aria-label={`${pin.length} de 4 números digitados`} role="status">
                {[0, 1, 2, 3].map((i) => <span key={i} className="login-dot" data-on={i < pin.length || undefined} />)}
              </div>
              <p className="login-msg" role="alert">
                {lockedFor ? `Muitas tentativas. Espere ${lockedFor} segundos.` : shake && !ok ? `PIN errado. Faltam ${MAX_TRIES - (tries[person.u.id]?.n ?? 0)} tentativas.` : ok ? "Entrando…" : " "}
              </p>
              <div className="login-pad" aria-label="Teclado do PIN">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                  <button key={d} type="button" className="login-key" disabled={!!lockedFor || ok} onClick={() => press(d)}>{d}</button>
                ))}
                <span aria-hidden />
                <button type="button" className="login-key" disabled={!!lockedFor || ok} onClick={() => press("0")}>0</button>
                <button type="button" className="login-key is-icon" aria-label="Apagar" disabled={!pin || ok} onClick={back}><Backspace size={26} weight="duotone" aria-hidden /></button>
              </div>
              <p className="login-help">Esqueceu o PIN? Peça ao dono para trocar em Pessoas › Funcionários.</p>
            </div>
          )}
        </section>

        <p className="login-demo">Demonstração: dados fictícios, só neste navegador. PIN de todos: <strong>{DEMO_PIN}</strong>.</p>
      </div>
    </main>
  );
}
