"use client";

import { ArrowLeft, Buildings, Eye, EyeSlash } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useDemoState } from "@/app-state/app-context";
import { Field, Input } from "@/components/ui/primitives";
import { demoStore } from "@/demo/store";
import { DEMO_OWNER_PASSWORD } from "@/demo/seed";
import type { ID } from "@/domain/types";
import { maskDigits, maskEmail } from "@/lib/masks";
import { checkEmail, checkPassword, maskedEmail, ownedWorkshops, setOwnerPassword, setOwnerPin, type EmailCheck } from "@/services/auth";
import { DomainError } from "@/services/core";

/**
 * Conectar o aparelho à oficina (decisão 74). Só o dono faz, com o e-mail que
 * a GAVYO cadastrou. Primeiro acesso: código por e-mail → cria a senha → cria o
 * PIN. Depois: e-mail e senha. Esqueceu a senha: código por e-mail de novo.
 * Termina com o dono já dentro do sistema (pelo rasante).
 */

type Step = "email" | "password" | "code" | "new-password" | "pin" | "shop";
type Owner = { userId: ID; name: string; email: string; first: boolean };

const CODE_TTL = 10 * 60_000;
const MAX_TRIES = 5;
const clock = () => Date.now();
const newCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");

export function ConnectDevice({ wide, canCancel, onCancel, onConnected }: {
  wide: boolean;
  /** Já há uma oficina neste aparelho: dá para voltar sem trocar. */
  canCancel: boolean;
  onCancel: () => void;
  onConnected: (workshopId: ID, userId: ID) => void;
}) {
  const db = useDemoState()?.db;
  const [step, setStepRaw] = useState<Step>("email");
  const [owner, setOwner] = useState<Owner | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [code, setCode] = useState<{ value: string; at: number; tries: number } | null>(null);
  const [typedCode, setTypedCode] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | EmailCheck["kind"] | null>(null);
  const [wrong, setWrong] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const [now, setNow] = useState(clock);
  const first = useRef<HTMLInputElement>(null);
  const setStep = (to: Step) => { setError(null); setStepRaw(to); };
  const deviceWord = wide ? "computador" : "aparelho";

  useEffect(() => { first.current?.focus(); }, [step]);
  useEffect(() => {
    if (lockUntil <= now) return;
    const t = setInterval(() => setNow(clock()), 500);
    return () => clearInterval(t);
  }, [lockUntil, now]);

  if (!db) return null;
  const lockedFor = lockUntil > now ? Math.ceil((lockUntil - now) / 1000) : 0;
  const shops = owner ? ownedWorkshops(db, owner.userId) : [];
  const shopName = (id: ID) => db.settings.find((s) => s.workshopId === id)?.displayName ?? db.workshops.find((w) => w.id === id)?.name ?? "";

  const finish = (o: Owner) => {
    const mine = ownedWorkshops(demoStore.getState().db, o.userId);
    if (mine.length === 1) onConnected(mine[0], o.userId);
    else setStep("shop");
  };
  const sendCode = () => { setCode({ value: newCode(), at: clock(), tries: 0 }); setTypedCode(""); setStep("code"); };

  const submit = () => {
    setError(null);
    try {
      if (step === "email") {
        const r = checkEmail(db, email);
        if (r.kind === "unknown" || r.kind === "not-owner") { setError(r.kind); return; }
        const o = { userId: r.userId, name: r.name, email: email.trim().toLowerCase(), first: r.kind === "first-access" };
        setOwner(o);
        setPassword("");
        if (o.first) sendCode(); else setStep("password");
      } else if (step === "password" && owner) {
        if (lockedFor) return;
        if (checkPassword(db, owner.userId, password)) { finish(owner); return; }
        const n = wrong + 1;
        setWrong(n >= MAX_TRIES ? 0 : n);
        if (n >= MAX_TRIES) { setLockUntil(clock() + 60_000); setNow(clock()); }
        setError(n >= MAX_TRIES ? "Muitas tentativas. Espere 1 minuto ou use “Esqueci a senha”." : `Senha errada. ${MAX_TRIES - n === 1 ? "Falta 1 tentativa." : `Faltam ${MAX_TRIES - n} tentativas.`}`);
      } else if (step === "code" && code) {
        if (clock() - code.at > CODE_TTL) { setError("Esse código venceu. Toque em “Mandar outro código”."); return; }
        if (code.tries >= MAX_TRIES) { setError("Muitas tentativas. Mande outro código."); return; }
        if (typedCode !== code.value) { setCode({ ...code, tries: code.tries + 1 }); setError("Código errado. Confira no seu e-mail."); return; }
        setPassword("");
        setStep("new-password");
      } else if (step === "new-password" && owner) {
        demoStore.mutateSignedOut((d) => setOwnerPassword(d, owner.userId, password));
        if (owner.first) { setPin(""); setStep("pin"); } else finish(owner);
      } else if (step === "pin" && owner) {
        demoStore.mutateSignedOut((d) => setOwnerPin(d, owner.userId, pin));
        finish(owner);
      }
    } catch (e) {
      setError(e instanceof DomainError ? e.message : e instanceof Error && "issues" in e ? "Confira o que foi digitado." : "Não deu certo. Tente de novo.");
    }
  };

  const T = wide ? "login-form-title" : "login-title";
  const S = wide ? "login-form-sub" : "login-sub";
  const back = (to: Step) => (
    <button type="button" className="login-back" onClick={() => setStep(to)}>
      <ArrowLeft size={18} weight="bold" aria-hidden /> Voltar
    </button>
  );
  const message = typeof error === "string" && error !== "unknown" && error !== "not-owner" ? error : null;

  return (
    <form className="connect" data-wide={wide || undefined} noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
      {step === "email" && (
        <>
          {canCancel && (
            <button type="button" className="login-back" onClick={onCancel}><ArrowLeft size={18} weight="bold" aria-hidden /> Voltar para o PIN</button>
          )}
          <h1 className={T}>Conectar este {deviceWord}</h1>
          <p className={S}>Só na primeira vez: o dono da oficina entra com o e-mail que a GAVYO cadastrou. Depois, cada um entra com o próprio PIN.</p>
          <Field label="E-mail do dono" error={message ?? undefined}>
            {(p) => <Input {...p} ref={first} className="connect-input" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => { setEmail(maskEmail(e.target.value)); setError(null); }} />}
          </Field>
          {error === "unknown" && (
            <div className="connect-note" role="alert">
              <strong>Não achamos esse e-mail.</strong> Confira se digitou certo. A conta da oficina é criada pela GAVYO: se ainda não tem, fale com a gente.
            </div>
          )}
          {error === "not-owner" && (
            <div className="connect-note" role="alert">
              <strong>Esse e-mail é de funcionário.</strong> Só o dono conecta o {deviceWord} à oficina. Depois disso, você entra tocando no seu nome e digitando o seu PIN.
            </div>
          )}
          <button type="submit" className="connect-cta" disabled={!email}>Continuar</button>
        </>
      )}

      {step === "password" && owner && (
        <>
          {back("email")}
          <h1 className={T}>Olá, {owner.name.split(" ")[0]}. Digite sua senha</h1>
          <p className={S}>{owner.email}</p>
          <input type="email" autoComplete="username" value={owner.email} readOnly hidden />
          <PasswordField inputRef={first} label="Senha" value={password} onChange={setPassword} show={show} setShow={setShow} autoComplete="current-password" error={message ?? undefined} disabled={!!lockedFor} />
          {!!lockedFor && <p className="login-msg" role="alert">Espere {lockedFor} segundos.</p>}
          <button type="submit" className="connect-cta" disabled={!password || !!lockedFor}>Entrar</button>
          <button type="button" className="login-link connect-alt" onClick={sendCode}>Esqueci a senha</button>
        </>
      )}

      {step === "code" && owner && code && (
        <>
          {back(owner.first ? "email" : "password")}
          <h1 className={T}>{owner.first ? "Primeiro acesso" : "Trocar a senha"}</h1>
          <p className={S}>Mandamos um código de 6 números para <strong>{maskedEmail(owner.email)}</strong>. Ele vale por 10 minutos.</p>
          <Field label="Código do e-mail" error={message ?? undefined}>
            {(p) => <Input {...p} ref={first} className="connect-input connect-code" inputMode="numeric" autoComplete="one-time-code" value={typedCode} onChange={(e) => { setTypedCode(maskDigits(e.target.value, 6)); setError(null); }} />}
          </Field>
          <button type="submit" className="connect-cta" disabled={typedCode.length !== 6}>Confirmar código</button>
          <button type="button" className="login-link connect-alt" onClick={sendCode}>Mandar outro código</button>
          <p className="login-demo">Demonstração: nenhum e-mail é enviado. O código é <strong>{code.value}</strong>.</p>
        </>
      )}

      {step === "new-password" && owner && (
        <>
          <h1 className={T}>{owner.first ? "Crie sua senha" : "Crie uma senha nova"}</h1>
          <p className={S}>Você vai usar com o e-mail para conectar outros aparelhos e trocar de oficina. Pelo menos 8 caracteres.</p>
          <PasswordField inputRef={first} label="Senha nova" value={password} onChange={setPassword} show={show} setShow={setShow} autoComplete="new-password" error={message ?? undefined} />
          <p className="connect-meter" data-ok={password.length >= 8 || undefined}>{password.length >= 8 ? "Tamanho bom." : `Faltam ${8 - password.length} caracteres.`}</p>
          <button type="submit" className="connect-cta" disabled={password.length < 8}>{owner.first ? "Continuar" : "Salvar e entrar"}</button>
        </>
      )}

      {step === "pin" && owner && (
        <>
          <h1 className={T}>Agora o seu PIN</h1>
          <p className={S}>São 4 números para entrar no dia a dia, sem e-mail. Os funcionários ganham o PIN quando você os cadastra em Pessoas.</p>
          <Field label="Seu PIN de 4 números" error={message ?? undefined}>
            {(p) => <Input {...p} ref={first} className="connect-input connect-code" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => { setPin(maskDigits(e.target.value, 4)); setError(null); }} />}
          </Field>
          <button type="submit" className="connect-cta" disabled={pin.length !== 4}>Pronto, entrar</button>
        </>
      )}

      {step === "shop" && owner && (
        <>
          <h1 className={T}>Qual oficina usa este {deviceWord}?</h1>
          <p className={S}>Você é dono de mais de uma.</p>
          <div className="login-shops">
            {shops.map((id) => (
              <button key={id} type="button" className="login-shop" onClick={() => onConnected(id, owner.userId)}>
                <Buildings size={24} weight="duotone" aria-hidden />
                <span>{shopName(id)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {step === "email" && (
        <p className="login-demo">Demonstração — primeiro acesso: <strong>carlos@oficinamodelo.demo</strong>. Já com senha: <strong>marcos@castelao.demo</strong> / <strong>{DEMO_OWNER_PASSWORD}</strong>.</p>
      )}
    </form>
  );
}

function PasswordField({ inputRef, label, value, onChange, show, setShow, autoComplete, error, disabled }: {
  inputRef: React.Ref<HTMLInputElement>; label: string; value: string; onChange: (v: string) => void;
  show: boolean; setShow: (v: boolean) => void; autoComplete: string; error?: string; disabled?: boolean;
}) {
  return (
    <Field label={label} error={error}>
      {(p) => (
        <div className="connect-pass">
          <Input {...p} ref={inputRef} className="connect-input" type={show ? "text" : "password"} autoComplete={autoComplete} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
          <button type="button" className="connect-eye" aria-label={show ? "Esconder senha" : "Mostrar senha"} aria-pressed={show} onClick={() => setShow(!show)}>
            {show ? <EyeSlash size={22} weight="duotone" aria-hidden /> : <Eye size={22} weight="duotone" aria-hidden />}
          </button>
        </div>
      )}
    </Field>
  );
}
