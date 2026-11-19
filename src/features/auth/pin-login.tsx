"use client";

import { ArrowLeft, Backspace, CaretRight } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useDemoState } from "@/app-state/app-context";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Skeleton } from "@/components/ui/primitives";
import { demoStore } from "@/demo/store";
import { ROLE_LABELS } from "@/domain/permissions";
import type { ID } from "@/domain/types";
import { usePref } from "@/lib/prefs";
import { motionReduced } from "@/lib/view-transition";
import { playSwoop } from "@/components/ui/swoop";
import { ConnectDevice } from "./connect-device";
import { DEMO_PIN, verifyPin } from "@/services/admin";

/**
 * Tela de entrada (decisão 70): central e limpa, a águia pousa ao lado do nome
 * GAVYO; cada funcionário toca no próprio nome e digita o PIN de 4 números
 * (como as maquininhas Square/Toast). 5 erros travam 30 s.
 * No computador (decisão 73): painel azul da marca à esquerda (águia, oficina,
 * relógio) e formulário à direita, com o PIN digitado no teclado.
 */

const WIDE = "(min-width: 1024px) and (min-height: 560px)";
const subscribeWide = (cb: () => void) => { const m = window.matchMedia(WIDE); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };
const useWide = () => useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => true);

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
  // Acabou de conectar: a tela de conexão fica até o rasante cobrir (sem piscar a lista de pessoas).
  const [joining, setJoining] = useState(false);
  // undefined = ninguém escolheu ainda: abre direto em quem entrou por último (só digitar o PIN).
  const [chosen, setUserId] = useState<ID | null | undefined>(undefined);
  const [lastUser, setLastUser] = usePref<string>("last-user", "");
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(0);
  const [ok, setOk] = useState(false);
  // Guardado no aparelho: recarregar a página não zera a trava (na fase 2, no servidor).
  const [tries, setTries] = usePref<Record<string, { n: number; until: number }>>("pin-tries", {});
  const [now, setNow] = useState(() => Date.now());
  const pinTitle = useRef<HTMLHeadingElement>(null);
  const pinInput = useRef<HTMLInputElement>(null);
  const wide = useWide();
  const [clock, setClock] = useState(() => new Date());

  // Aparelho sem oficina conectada: só o dono conecta, com e-mail (decisão 74).
  const connected = !!db?.workshops.some((w) => w.id === deviceWs);
  const workshopId = connected ? deviceWs : "";
  const settings = db?.settings.find((s) => s.workshopId === workshopId);
  const members = (db?.memberships.filter((m) => m.workshopId === workshopId && m.active) ?? [])
    .map((m) => ({ m, u: db!.users.find((x) => x.id === m.userId)! }))
    .sort((a, b) => a.u.name.localeCompare(b.u.name, "pt-BR"));
  const userId: ID | null = chosen !== undefined ? chosen : members.some((x) => x.u.id === lastUser) ? lastUser : null;
  const person = members.find((x) => x.u.id === userId);
  const connecting = !connected || choosingWs || joining;
  const lock = userId ? tries[userId] : undefined;
  const lockedFor = lock && lock.until > now ? Math.ceil((lock.until - now) / 1000) : 0;

  useEffect(() => {
    if (!lockedFor) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [lockedFor]);

  // Abrir a tela de entrada encerra quem estava dentro: ninguém volta ao sistema sem PIN.
  useEffect(() => { if (demoStore.getState().session) demoStore.logout(); }, []);

  const enter = useCallback((ws: ID, uid: ID) => {
    setOk(true);
    // Celular: a águia bate as asas (~0,5 s) e dá o rasante. Computador: a águia do
    // painel decola para o alto e o rasante volta de lá logo em seguida.
    window.setTimeout(() => playSwoop(() => {
      try { demoStore.login(ws, uid); router.replace("/inicio"); }
      catch { setOk(false); setJoining(false); setUserId(null); setPin(""); }
    }), motionReduced() ? 0 : wide ? 180 : 450);
  }, [router, wide]);

  const submit = useCallback((value: string) => {
    if (!db || !userId) return;
    if (verifyPin(db, workshopId, userId, value)) {
      setTries((t) => { const rest = { ...t }; delete rest[userId]; return rest; });
      setLastUser(userId);
      enter(workshopId, userId);
      return;
    }
    const n = (tries[userId]?.n ?? 0) + 1;
    setTries({ ...tries, [userId]: { n: n >= MAX_TRIES ? 0 : n, until: n >= MAX_TRIES ? Date.now() + LOCK_MS : 0 } });
    setNow(Date.now());
    setShake((x) => x + 1);
    window.setTimeout(() => setPin(""), 380);
  }, [db, enter, setLastUser, setTries, tries, userId, workshopId]);

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
      if (e.key === "Escape") { setUserId(null); setPin(""); }
      else if (wide) return;
      else if (/^\d$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (e.key === "Backspace") { e.preventDefault(); back(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back, press, userId, wide]);

  useEffect(() => { if (userId) (wide ? pinInput.current : pinTitle.current)?.focus(); }, [userId, wide]);
  // Acabou a trava: o campo volta a receber o PIN sem precisar clicar.
  useEffect(() => { if (wide && userId && !lockedFor) pinInput.current?.focus(); }, [lockedFor, userId, wide]);

  useEffect(() => {
    if (!wide) return;
    const t = setInterval(() => setClock(new Date()), 15_000);
    return () => clearInterval(t);
  }, [wide]);

  // No computador o PIN é um campo de verdade (aceita colar e leitor de tela).
  const typed = (raw: string) => {
    if (ok || lockedFor) return;
    const v = raw.replace(/\D/g, "").slice(0, 4);
    setPin(v);
    if (v.length === 4) window.setTimeout(() => submit(v), 120);
  };

  if (!db) {
    return <main className="login-screen"><div className="login-card" aria-busy="true"><Skeleton className="h-10" /><Skeleton className="h-40" /></div></main>;
  }

  const left = MAX_TRIES - (person ? tries[person.u.id]?.n ?? 0 : 0);
  const message = lockedFor ? `Muitas tentativas. Espere ${lockedFor} segundos.` : shake && !ok && person ? (left === 1 ? "PIN errado. Falta 1 tentativa." : `PIN errado. Faltam ${left} tentativas.`) : ok ? "Entrando…" : " ";

  if (wide) {
    const hour = clock.getHours();
    return (
      <main className="login-desk">
        <aside className="login-brand" aria-label="GAVYO">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/gavyo-nome.png" alt="GAVYO" className="login-brand-name" width={1030} height={278} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/gavyo-aguia.png" alt="" className="login-brand-eagle" data-off={ok || undefined} width={437} height={284} />
          <div className="login-brand-foot">
            <p className="login-brand-shop">{connected ? settings?.displayName : "GAVYO Auto"}</p>
            <p className="login-brand-clock" suppressHydrationWarning>{clock.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
            <p className="login-brand-day" suppressHydrationWarning>
              {hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite"} · {clock.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
        </aside>

        <section className="login-form" aria-live="polite">
          <div key={connecting ? "ws" : person ? "pin" : "who"} className="login-form-step">
            {connecting ? (
              <ConnectDevice
                wide={true}
                canCancel={connected && !joining}
                onCancel={() => setChoosingWs(false)}
                onConnected={(ws, uid) => { setJoining(true); setDeviceWs(ws); setLastUser(uid); setTries({}); enter(ws, uid); }}
              />
            ) : (
              <>
                <h1 className="login-form-title">Quem está entrando?</h1>
                <p className="login-form-sub">Clique no seu nome e digite o PIN. <button type="button" className="login-link" onClick={() => setChoosingWs(true)}>Trocar de oficina</button></p>
                {/* O PIN abre na própria linha: nada de trocar de tela para entrar (decisão 75). */}
                <ul className="login-rows">
                  {members.map(({ m, u }, i) => {
                    const open = u.id === userId;
                    return (
                      <li key={m.id} className="login-item" data-open={open || undefined} style={{ "--i": i } as React.CSSProperties}>
                        <button type="button" className="login-row" aria-expanded={open} onClick={() => { setUserId(open ? null : u.id); setPin(""); }} disabled={ok}>
                          <PersonAvatar name={u.name} photo={u.photo} size={44} />
                          <span className="login-row-text"><span className="login-row-name">{u.name}</span><span className="login-row-role">{ROLE_LABELS[m.role]}</span></span>
                          <CaretRight size={20} weight="bold" aria-hidden className="login-row-go" />
                        </button>
                        <div className="login-row-pin">
                          {open && (
                            <div className="login-row-pin-in">
                              <label className="login-field-label" htmlFor="login-pin">PIN de {u.name.split(" ")[0]}</label>
                              <div className="login-boxes" data-ok={ok || undefined} onClick={() => pinInput.current?.focus()}>
                                <input
                                  id="login-pin" ref={pinInput} className="login-boxes-input" type="password" inputMode="numeric" autoComplete="off" maxLength={4}
                                  value={pin} disabled={!!lockedFor || ok} onChange={(e) => typed(e.target.value)} aria-describedby="login-pin-msg"
                                />
                                {/* Só a fileira é recriada para balançar; o campo fica, e com ele o foco. */}
                                <div key={shake} className="login-boxes-row" data-shake={shake ? true : undefined}>
                                  {[0, 1, 2, 3].map((k) => <span key={k} className="login-box" style={{ "--k": k } as React.CSSProperties} data-on={k < pin.length || undefined} data-next={k === pin.length || undefined} />)}
                                </div>
                              </div>
                              <p id="login-pin-msg" className="login-msg" role="alert">{message}</p>
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="login-help">Entra sozinho no 4º número. Esqueceu o PIN? Peça ao dono para trocar em Pessoas.</p>
              </>
            )}
          </div>
          {!connecting && <p className="login-demo">Demonstração: dados fictícios, só neste navegador. PIN de todos: <strong>{DEMO_PIN}</strong>.</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="login-screen">
      <div className="login-stack">
        <Logo flap={ok} />

        <section className="login-card" aria-live="polite">
          {connecting ? (
            <ConnectDevice
                wide={false}
                canCancel={connected && !joining}
                onCancel={() => setChoosingWs(false)}
                onConnected={(ws, uid) => { setJoining(true); setDeviceWs(ws); setLastUser(uid); setTries({}); enter(ws, uid); }}
              />
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
                {message}
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

        {!connecting && <p className="login-demo">Demonstração: dados fictícios, só neste navegador. PIN de todos: <strong>{DEMO_PIN}</strong>.</p>}
      </div>
    </main>
  );
}
