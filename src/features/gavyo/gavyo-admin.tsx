"use client";

import { ArrowsClockwise, Copy, Key, Plus, Power, ShieldCheck, SignOut, WhatsappLogo } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "@/app-state/server-store";
import { SERVER_MODE } from "@/app-state/store";
import { Dialog } from "@/components/ui/dialog";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Button, Field, Input, Skeleton } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { maskEmail, maskPhone } from "@/lib/masks";

/**
 * Tela interna da GAVYO (decisão 98): criar oficina e dono, ver quem está
 * usando, trocar a senha do dono e desativar. Não aparece em nenhum menu.
 */

interface Row {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
  active: boolean;
  owner: { id: string; name: string; email: string } | null;
  people: number;
  devices: number;
  lastUse: string | null;
}

interface Credentials { workshop: string; owner: string; email: string; password: string; pin?: string }

/** Senha fácil de ditar por telefone: 3 sílabas + 4 números (ex.: "bolapeta4821"). */
function suggestPassword(): string {
  const s = ["ba", "be", "bo", "ca", "co", "da", "do", "fa", "fe", "la", "lo", "ma", "me", "mo", "na", "pa", "pe", "ra", "ro", "sa", "ta", "to", "va", "vi"];
  const r = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  return `${s[r(s.length)]}${s[r(s.length)]}${s[r(s.length)]}${String(1000 + r(9000))}`;
}

function since(iso: string | null): string {
  if (!iso) return "ainda não conectou";
  const d = new Date(iso.replace(" ", "T") + (iso.endsWith("Z") ? "" : "Z"));
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return days <= 0 ? "usou hoje" : days === 1 ? "usou ontem" : `usou há ${days} dias`;
}

function message(c: Credentials): string {
  return [
    `Olá, ${c.owner.split(" ")[0]}! Seu acesso ao GAVYO Auto (${c.workshop}):`,
    "",
    `Site: ${typeof window !== "undefined" ? window.location.origin : ""}`,
    `E-mail: ${c.email}`,
    `Senha: ${c.password}`,
    ...(c.pin ? [`Seu PIN: ${c.pin}`] : []),
    "",
    "No primeiro acesso de cada computador ou celular, entre com o e-mail e a senha. Depois, é só tocar no seu nome e digitar o PIN.",
  ].join("\n");
}

function CredentialsCard({ c, onClose }: { c: Credentials; onClose: () => void }) {
  const text = message(c);
  return (
    <Dialog title="Pronto! Envie o acesso ao dono" subtitle="A senha só aparece agora. Copie ou envie antes de fechar." onClose={onClose}
      footer={<Button variant="primary" onClick={onClose}>Já enviei</Button>}>
      <dl className="gv-cred">
        <div><dt>Oficina</dt><dd>{c.workshop}</dd></div>
        <div><dt>E-mail</dt><dd>{c.email}</dd></div>
        <div><dt>Senha</dt><dd className="gv-secret">{c.password}</dd></div>
        {c.pin && <div><dt>PIN</dt><dd className="gv-secret">{c.pin}</dd></div>}
      </dl>
      <div className="gv-cred-actions">
        <Button onClick={() => navigator.clipboard.writeText(text).then(() => toast("success", "Mensagem copiada."), () => toast("error", "Não deu para copiar."))}>
          <Copy size={18} weight="bold" aria-hidden /> Copiar mensagem
        </Button>
        <a className="gv-wa" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
          <WhatsappLogo size={20} weight="fill" aria-hidden /> Enviar no WhatsApp
        </a>
      </div>
    </Dialog>
  );
}

function NewWorkshop({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Credentials) => void }) {
  const [f, setF] = useState({ workshopName: "", phone: "", ownerName: "", ownerEmail: "", ownerPassword: suggestPassword(), ownerPin: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => { setError(null); setF({ ...f, [k]: k === "ownerEmail" ? maskEmail(e.target.value) : k === "phone" ? maskPhone(e.target.value) : k === "ownerPin" ? e.target.value.replace(/\D/g, "").slice(0, 4) : e.target.value }); };
  const save = async () => {
    setBusy(true);
    const r = await api("/api/gavyo/oficinas", f).catch(() => null);
    setBusy(false);
    if (!r) return setError("Sem internet. Tente de novo.");
    if (!r.ok) return setError(await errorText(r));
    onCreated({ workshop: f.workshopName.trim(), owner: f.ownerName.trim(), email: f.ownerEmail.trim().toLowerCase(), password: f.ownerPassword, pin: f.ownerPin });
  };
  return (
    <Dialog title="Nova oficina" subtitle="A oficina já nasce pronta para usar, com o dono cadastrado." onClose={onClose}
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={busy || !f.workshopName || !f.ownerName || !f.ownerEmail || f.ownerPassword.length < 8 || f.ownerPin.length !== 4} onClick={save}>{busy ? "Criando…" : "Criar oficina"}</Button></>}>
      <form className="gv-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <fieldset>
          <legend>A oficina</legend>
          <Field label="Nome da oficina">{(p) => <Input {...p} value={f.workshopName} onChange={set("workshopName")} placeholder="Ex.: Auto Center Silva" autoFocus />}</Field>
          <Field label="Telefone" optional>{(p) => <Input {...p} inputMode="tel" value={f.phone} onChange={set("phone")} placeholder="(85) 99999-9999" />}</Field>
        </fieldset>
        <fieldset>
          <legend>O dono</legend>
          <Field label="Nome">{(p) => <Input {...p} value={f.ownerName} onChange={set("ownerName")} />}</Field>
          <Field label="E-mail" hint="É com ele que o dono conecta cada computador ou celular.">{(p) => <Input {...p} type="email" inputMode="email" autoCapitalize="none" spellCheck={false} value={f.ownerEmail} onChange={set("ownerEmail")} />}</Field>
          <div className="gv-two">
            <Field label="Senha" hint="Pelo menos 8 caracteres.">
              {(p) => (
                <div className="gv-pass">
                  <Input {...p} value={f.ownerPassword} onChange={set("ownerPassword")} autoComplete="off" spellCheck={false} />
                  <button type="button" className="gv-icon" aria-label="Sugerir outra senha" onClick={() => setF({ ...f, ownerPassword: suggestPassword() })}><ArrowsClockwise size={18} weight="bold" aria-hidden /></button>
                </div>
              )}
            </Field>
            <Field label="PIN do dono" hint="4 números.">{(p) => <Input {...p} inputMode="numeric" value={f.ownerPin} onChange={set("ownerPin")} autoComplete="off" />}</Field>
          </div>
        </fieldset>
        {error && <p className="gv-error" role="alert">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

function ResetPassword({ row, onClose, onDone }: { row: Row; onClose: () => void; onDone: (c: Credentials) => void }) {
  const [password, setPassword] = useState(suggestPassword);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    const r = await api(`/api/gavyo/oficinas/${row.id}`, { action: "password", password }).catch(() => null);
    if (!r) return setError("Sem internet. Tente de novo.");
    if (!r.ok) return setError(await errorText(r));
    onDone({ workshop: row.name, owner: row.owner!.name, email: row.owner!.email, password });
  };
  return (
    <Dialog title={`Nova senha para ${row.owner?.name.split(" ")[0]}`} subtitle={`${row.name} · ${row.owner?.email}`} onClose={onClose}
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={password.length < 8} onClick={save}>Trocar senha</Button></>}>
      <Field label="Senha nova" hint="A senha antiga deixa de valer e todos os aparelhos da oficina vão pedir o e-mail e a senha nova.">
        {(p) => (
          <div className="gv-pass">
            <Input {...p} value={password} onChange={(e) => { setError(null); setPassword(e.target.value); }} autoComplete="off" spellCheck={false} autoFocus />
            <button type="button" className="gv-icon" aria-label="Sugerir outra senha" onClick={() => setPassword(suggestPassword())}><ArrowsClockwise size={18} weight="bold" aria-hidden /></button>
          </div>
        )}
      </Field>
      {error && <p className="gv-error" role="alert">{error}</p>}
    </Dialog>
  );
}

function KeyLogin({ onIn }: { onIn: () => void }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    const r = await api("/api/gavyo/entrar", { key }).catch(() => null);
    setBusy(false);
    if (!r) return setError("Sem internet. Tente de novo.");
    if (!r.ok) return setError(await errorText(r));
    onIn();
  };
  return (
    <form className="gv-key" onSubmit={(e) => { e.preventDefault(); void go(); }}>
      <ShieldCheck size={40} weight="duotone" aria-hidden className="gv-key-icon" />
      <h1>Área da GAVYO</h1>
      <p>Só para a equipe da GAVYO criar e cuidar das oficinas.</p>
      <Field label="Chave da GAVYO" error={error ?? undefined}>{(p) => <Input {...p} type="password" value={key} onChange={(e) => { setError(null); setKey(e.target.value); }} autoComplete="off" autoFocus />}</Field>
      <Button variant="primary" type="submit" disabled={!key || busy}>{busy ? "Conferindo…" : "Entrar"}</Button>
    </form>
  );
}

export function GavyoAdmin() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [locked, setLocked] = useState(false);
  const [creating, setCreating] = useState(false);
  const [reset, setReset] = useState<Row | null>(null);
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);

  const load = useCallback(async (): Promise<Row[]> => {
    const r = await api("/api/gavyo/oficinas").catch(() => null);
    if (!r) { toast("error", "Sem internet."); return []; }
    if (r.status === 403) { setLocked(true); setRows(null); return []; }
    if (!r.ok) { toast("error", await errorText(r)); return []; }
    const data = (await r.json()) as { workshops?: Row[]; locked?: boolean };
    if (data.locked || !data.workshops) { setLocked(true); setRows(null); return []; }
    const list = data.workshops;
    setLocked(false);
    setRows(list);
    return list;
  }, []);

  useEffect(() => { if (SERVER_MODE) void Promise.resolve().then(load); }, [load]);

  if (!SERVER_MODE) {
    return <main className="gv-page"><div className="gv-key"><h1>Área da GAVYO</h1><p>Só funciona com o servidor ligado. Na demonstração, as oficinas são de exemplo.</p></div></main>;
  }
  if (locked) return <main className="gv-page"><KeyLogin onIn={() => void load()} /></main>;

  const toggle = async (row: Row) => {
    if (row.active && !window.confirm(`Desativar ${row.name}? Ninguém entra até ativar de novo, e os aparelhos são desconectados. Os dados ficam guardados.`)) return;
    const r = await api(`/api/gavyo/oficinas/${row.id}`, { action: "active", active: !row.active }).catch(() => null);
    if (!r?.ok) return toast("error", r ? await errorText(r) : "Sem internet.");
    toast("success", row.active ? `${row.name} desativada.` : `${row.name} ativada.`);
    void load();
  };

  const active = rows?.filter((r) => r.active).length ?? 0;

  return (
    <main className="gv-page">
      <header className="gv-head">
        <div>
          <p className="gv-eyebrow">Área da GAVYO</p>
          <h1>Oficinas</h1>
          <p className="gv-sub">{rows ? (rows.length ? `${active} ${active === 1 ? "ativa" : "ativas"}${rows.length > active ? ` · ${rows.length - active} desativada${rows.length - active === 1 ? "" : "s"}` : ""}` : "Nenhuma oficina ainda.") : " "}</p>
        </div>
        <div className="gv-head-actions">
          <Button variant="primary" className="rounded-full" onClick={() => setCreating(true)}><Plus size={18} weight="bold" aria-hidden /> Nova oficina</Button>
          <Button variant="ghost" onClick={() => void api("/api/gavyo/sair", {}).then(() => { setLocked(true); setRows(null); })}><SignOut size={18} weight="bold" aria-hidden /> Sair</Button>
        </div>
      </header>

      {!rows ? (
        <div className="gv-list"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      ) : !rows.length ? (
        <div className="gv-empty">
          <p>Crie a primeira oficina. O dono recebe o e-mail e a senha e já pode usar.</p>
          <Button variant="primary" className="rounded-full" onClick={() => setCreating(true)}><Plus size={18} weight="bold" aria-hidden /> Nova oficina</Button>
        </div>
      ) : (
        <ul className="gv-list">
          {rows.map((r, i) => (
            <li key={r.id} className="gv-row" data-off={!r.active || undefined} data-fresh={fresh === r.id || undefined} style={{ "--i": i } as React.CSSProperties}>
              <PersonAvatar name={r.name} size={48} />
              <div className="gv-row-main">
                <p className="gv-row-name">{r.name} {!r.active && <span className="gv-tag">Desativada</span>}</p>
                <p className="gv-row-owner">{r.owner ? `${r.owner.name} · ${r.owner.email}` : "Sem dono ativo"}</p>
                <p className="gv-row-use">{r.people} {r.people === 1 ? "pessoa" : "pessoas"} · {r.devices} {r.devices === 1 ? "aparelho" : "aparelhos"} · {since(r.lastUse)}</p>
              </div>
              <div className="gv-row-actions">
                {r.owner && r.active && <Button size="sm" onClick={() => setReset(r)}><Key size={16} weight="bold" aria-hidden /> Trocar senha</Button>}
                <Button size="sm" variant="ghost" onClick={() => void toggle(r)}><Power size={16} weight="bold" aria-hidden /> {r.active ? "Desativar" : "Ativar"}</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {creating && <NewWorkshop onClose={() => setCreating(false)} onCreated={(c) => { setCreating(false); setCreds(c); void load().then((list) => setFresh(list[0]?.id ?? null)); }} />}
      {reset && <ResetPassword row={reset} onClose={() => setReset(null)} onDone={(c) => { setReset(null); setCreds(c); }} />}
      {creds && <CredentialsCard c={creds} onClose={() => setCreds(null)} />}
    </main>
  );
}
