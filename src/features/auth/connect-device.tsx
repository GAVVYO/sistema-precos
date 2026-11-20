"use client";

import { ArrowLeft, Buildings, Eye, EyeSlash } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useDemoState } from "@/app-state/app-context";
import { api, errorText } from "@/app-state/server-store";
import { SERVER_MODE } from "@/app-state/store";
import { Field, Input } from "@/components/ui/primitives";
import { DEMO_OWNER_PASSWORD } from "@/demo/seed";
import type { ID } from "@/domain/types";
import { maskEmail } from "@/lib/masks";
import { checkEmail, checkPassword, ownedWorkshops } from "@/services/auth";
import { DomainError } from "@/services/core";

/**
 * Conectar o aparelho (decisão 75): a GAVYO cria a conta e entrega e-mail e
 * senha ao dono; ele só entra. Uma tela, dois campos, um botão — e já cai
 * dentro do sistema pelo rasante. Funcionário não conecta: entra pelo PIN.
 */

const MAX_TRIES = 5;
const clock = () => Date.now();

export function ConnectDevice({ wide, canCancel, onCancel, onConnected }: {
  wide: boolean;
  /** Já há uma oficina neste aparelho: dá para voltar sem trocar. */
  canCancel: boolean;
  onCancel: () => void;
  onConnected: (workshopId: ID, userId: ID) => void;
}) {
  const demoState = useDemoState();
  const db = SERVER_MODE ? null : demoState?.db;
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<{ field: "email" | "password" | "form"; text: string } | null>(null);
  const [shake, setShake] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const [now, setNow] = useState(clock);
  const [owner, setOwner] = useState<ID | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  useEffect(() => { emailRef.current?.focus(); }, []);
  useEffect(() => {
    if (lockUntil <= now) return;
    const t = setInterval(() => setNow(clock()), 500);
    return () => clearInterval(t);
  }, [lockUntil, now]);

  if (!db && !SERVER_MODE) return null;
  const lockedFor = lockUntil > now ? Math.ceil((lockUntil - now) / 1000) : 0;
  const T = wide ? "login-form-title" : "login-title";
  const S = wide ? "login-form-sub" : "login-sub";
  const fail = (field: "email" | "password" | "form", text: string) => {
    setError({ field, text });
    setShake((x) => x + 1);
    (field === "password" ? passRef : emailRef).current?.focus();
  };

  const submit = () => {
    if (lockedFor || busy) return;
    setError(null);
    if (SERVER_MODE) {
      // Servidor: confere e-mail e senha lá (com bloqueio por tentativas) e já entra como dono.
      setBusy(true);
      api("/api/conectar", { email, password })
        .then(async (r) => {
          if (r.ok) { const d = (await r.json()) as { workshopId: ID; userId: ID }; onConnected(d.workshopId, d.userId); return; }
          setBusy(false);
          fail(r.status === 400 ? "email" : "password", await errorText(r));
        })
        .catch(() => { setBusy(false); fail("form", "Sem internet. Confira a conexão e tente de novo."); });
      return;
    }
    if (!db) return;
    try {
      const r = checkEmail(db, email);
      if (r.kind === "unknown") return fail("email", "Não achamos esse e-mail. Confira se digitou certo.");
      if (r.kind === "not-owner") return fail("email", "Esse e-mail é de funcionário. Só o dono conecta; você entra pelo seu nome e PIN.");
      if (!checkPassword(db, r.userId, password)) {
        const n = wrong + 1;
        setWrong(n >= MAX_TRIES ? 0 : n);
        if (n >= MAX_TRIES) { setLockUntil(clock() + 60_000); setNow(clock()); }
        return fail("password", n >= MAX_TRIES ? "Muitas tentativas. Espere 1 minuto." : `Senha errada. ${MAX_TRIES - n === 1 ? "Falta 1 tentativa." : `Faltam ${MAX_TRIES - n} tentativas.`}`);
      }
      const mine = ownedWorkshops(db, r.userId);
      if (mine.length === 1) onConnected(mine[0], r.userId);
      else setOwner(r.userId);
    } catch (e) {
      fail("email", e instanceof DomainError ? e.message : "Digite um e-mail. Ex.: joao@suaoficina.com");
    }
  };

  if (owner && db) {
    return (
      <div className="connect">
        <h1 className={T}>Qual oficina usa este {wide ? "computador" : "aparelho"}?</h1>
        <div className="login-shops">
          {ownedWorkshops(db, owner).map((id) => (
            <button key={id} type="button" className="login-shop" onClick={() => onConnected(id, owner)}>
              <Buildings size={24} weight="duotone" aria-hidden />
              <span>{db.settings.find((s) => s.workshopId === id)?.displayName ?? id}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form className="connect" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
      {canCancel && (
        <button type="button" className="login-back" onClick={onCancel}><ArrowLeft size={18} weight="bold" aria-hidden /> Voltar</button>
      )}
      <h1 className={T}>Entrar na oficina</h1>
      <p className={S}>Use o e-mail e a senha que a GAVYO te passou. É só na primeira vez neste {wide ? "computador" : "aparelho"}.</p>
      <div key={shake} className="connect-fields" data-shake={shake ? true : undefined}>
        <Field label="E-mail" error={error?.field === "email" ? error.text : undefined}>
          {(p) => <Input {...p} ref={emailRef} className="connect-input" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => { setEmail(maskEmail(e.target.value)); setError(null); }} />}
        </Field>
        <Field label="Senha" error={error?.field === "password" ? error.text : undefined}>
          {(p) => (
            <div className="connect-pass">
              <Input {...p} ref={passRef} className="connect-input" type={show ? "text" : "password"} autoComplete="current-password" value={password} disabled={!!lockedFor} onChange={(e) => { setPassword(e.target.value); setError(null); }} />
              <button type="button" className="connect-eye" aria-label={show ? "Esconder senha" : "Mostrar senha"} aria-pressed={show} onClick={() => setShow(!show)}>
                {show ? <EyeSlash size={22} weight="duotone" aria-hidden /> : <Eye size={22} weight="duotone" aria-hidden />}
              </button>
            </div>
          )}
        </Field>
      </div>
      <button type="submit" className="connect-cta" disabled={!email || !password || !!lockedFor || busy}>
        {lockedFor ? `Espere ${lockedFor} s` : busy ? "Entrando…" : "Entrar"}
      </button>
      {error?.field === "form" && <p className="login-msg" role="alert">{error.text}</p>}
      <p className="connect-help">Esqueceu a senha? Fale com a GAVYO.</p>
      {!SERVER_MODE && <p className="login-demo">Demonstração: <strong>carlos@oficinamodelo.demo</strong> ou <strong>marcos@castelao.demo</strong>, senha <strong>{DEMO_OWNER_PASSWORD}</strong>.</p>}
    </form>
  );
}
