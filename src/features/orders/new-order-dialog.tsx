"use client";

import { ArrowLeft, ArrowRight, ArrowUpDown, BatteryCharging, CarFront, Check, CircleCheck, ClipboardCheck, ClipboardList, Disc, Droplet, Gauge, Pencil, RectangleHorizontal, Search, Snowflake, Sparkles, UserRound, Wrench, Zap } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { NewOrderPrefill, useApp } from "@/app-state/app-context";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { formatBRL, formatOrderNumber, formatPhone, formatPlate, normalizePhone, normalizePlate, parseBRL } from "@/lib/format";
import { markBorn } from "@/lib/born";
import { createOrder } from "@/services/orders";
import { DraftItem, draftsToItems, draftsTotal, PartsEditor, vehicleLabel } from "./shared";
import { maskDigits, maskMoney, maskPhone, maskPlate } from "@/lib/masks";

/**
 * Novo serviço em passos, uma pergunta por vez (referências: GOV.UK "one thing
 * per page", cadastros do Nubank e do iFood). Pergunta em tom de conversa,
 * campo grande, Enter continua, "Voltar" sempre à mão. Passos de carro e de
 * cliente só aparecem quando o carro ou o cliente ainda não estão cadastrados.
 * Valor, peças e observações ficam em "Mais detalhes" na conferência.
 */

const SERVICE_SUGGESTIONS: [string, typeof Droplet][] = [
  ["Troca de óleo e filtro", Droplet], ["Revisão", ClipboardCheck], ["Freios", Disc], ["Alinhamento e balanceamento", Gauge],
  ["Diagnóstico elétrico", Zap], ["Troca de bateria", BatteryCharging], ["Suspensão", ArrowUpDown], ["Ar-condicionado", Snowflake],
];
const STEP_META: Record<StepKey, { label: string; icon: typeof Droplet }> = {
  plate: { label: "Placa", icon: RectangleHorizontal }, car: { label: "Carro", icon: CarFront }, customer: { label: "Cliente", icon: UserRound },
  work: { label: "Serviço", icon: ClipboardList }, who: { label: "Quem faz", icon: Wrench }, review: { label: "Conferir", icon: CircleCheck },
};
const BRAND_SUGGESTIONS = ["Fiat", "Volkswagen", "Chevrolet", "Ford", "Toyota", "Hyundai", "Renault", "Honda", "Jeep"];

type StepKey = "plate" | "car" | "customer" | "work" | "who" | "review";
type LaborMode = "later" | "value" | "free";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

export function NewOrderDialog({ prefill, onClose }: { prefill: NewOrderPrefill; onClose: () => void }) {
  const { view, act, mechanics, openOrder, online } = useApp();
  const uid = useId();

  // Reaproveita cadastro vindo do agendamento (placa ou telefone).
  const initial = useMemo(() => {
    const p = prefill.plate ? normalizePlate(prefill.plate) : null;
    const byPlate = p ? view.vehicles.find((v) => v.plate === p) : undefined;
    const ph = prefill.phone ? normalizePhone(prefill.phone) : null;
    const customerId = prefill.customerId ?? byPlate?.customerId ?? (ph ? view.customers.find((c) => c.phone === ph)?.id ?? null : null);
    const vehicleId = prefill.vehicleId ?? byPlate?.id ?? null;
    return { customerId, vehicleId };
  }, [prefill, view]);

  const [plate, setPlate] = useState(prefill.plate ? formatPlate(prefill.plate) : "");
  const [vehicleId, setVehicleId] = useState<string | null>(initial.vehicleId);
  const [customerId, setCustomerId] = useState<string | null>(initial.customerId);
  const [brand, setBrand] = useState(prefill.brand ?? "");
  const [model, setModel] = useState(prefill.model ?? "");
  const [year, setYear] = useState("");
  const [mileage, setMileage] = useState("");
  const [name, setName] = useState(prefill.customerName ?? "");
  const [phone, setPhone] = useState(prefill.phone ? formatPhone(prefill.phone) : "");
  const [description, setDescription] = useState(prefill.description ?? "");
  const [mechanicId, setMechanicId] = useState<string | null | undefined>(prefill.mechanicId ?? undefined);
  const [laborMode, setLaborMode] = useState<LaborMode>("later");
  const [labor, setLabor] = useState("");
  const [notes, setNotes] = useState("");
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [findByName, setFindByName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const [stepIndex, setStepIndex] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);

  const normalized = normalizePlate(plate);
  const vehicle = vehicleId ? view.vehicles.find((v) => v.id === vehicleId) : undefined;
  const customer = customerId ? view.customers.find((c) => c.id === customerId) : undefined;
  const needsCar = !vehicle;
  const needsCustomer = !customer;

  // Passos aplicáveis (carro e cliente só quando não estão cadastrados).
  const steps: StepKey[] = ["plate", ...(needsCar ? (["car"] as const) : []), ...(needsCustomer ? (["customer"] as const) : []), "work", "who", "review"];
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const position = steps.indexOf(step) + 1;

  // Placa digitada que já existe: carro e dono reconhecidos na hora.
  const onPlate = (raw: string) => {
    const value = raw.toUpperCase();
    setPlate(value);
    const n = normalizePlate(value);
    const match = n ? view.vehicles.find((v) => v.plate === n) : undefined;
    if (match) { setVehicleId(match.id); setCustomerId(match.customerId); }
    else if (vehicleId) { setVehicleId(null); setCustomerId(null); }
  };

  const nameQuery = name.trim().toLowerCase();
  const nameMatches = nameQuery.length >= 2
    ? view.customers.filter((c) => c.name.toLowerCase().includes(nameQuery) || (nameQuery.replace(/\D/g, "").length >= 4 && c.phone.includes(nameQuery.replace(/\D/g, "")))).slice(0, 4)
    : [];

  const laborCents = laborMode === "free" ? 0 : laborMode === "value" ? parseBRL(labor) : null;
  const partsTotal = draftsTotal(drafts);

  const check = (s: StepKey): string | null => {
    if (s === "plate") {
      if (vehicle) return null;
      if (findByName) return "Escolha o cliente na lista ou volte para digitar a placa.";
      if (!plate.trim()) return "Digite a placa do carro.";
      if (!normalized) return "A placa parece incompleta. Exemplo: ABC1D23 ou ABC-1234.";
    }
    if (s === "car") {
      if (brand.trim().length < 2) return "Diga a marca do carro (ex.: Fiat).";
      if (model.trim().length < 1) return "Diga o modelo do carro (ex.: Uno).";
    }
    if (s === "customer") {
      if (name.trim().length < 2) return "Escreva o nome do dono do carro.";
      if (!normalizePhone(phone)) return "O telefone precisa ter DDD. Exemplo: (85) 98888-7777.";
    }
    if (s === "work" && description.trim().length < 3) return "Conte o que o cliente pediu (ou toque numa sugestão).";
    if (s === "who" && mechanicId === undefined) return "Escolha quem vai fazer, ou \"Ainda não sei\".";
    return null;
  };

  const goTo = (i: number) => { setError(null); setDir(i > stepIndex ? 1 : -1); setStepIndex(Math.max(0, Math.min(i, steps.length - 1))); };
  const next = () => {
    const problem = check(step);
    // O aviso aparece e o cursor volta para o campo, para a pessoa já corrigir.
    if (problem) { setError(problem); focusRef.current?.focus(); return; }
    if (step === "review") return submit();
    goTo(steps.indexOf(step) + 1);
  };
  const back = () => (stepIndex === 0 ? onClose() : goTo(steps.indexOf(step) - 1));

  const submit = () => {
    if (busy) return;
    for (const s of steps) {
      const problem = check(s);
      if (problem) { goTo(steps.indexOf(s)); return setError(problem); }
    }
    if (laborMode === "value" && laborCents === null) { setMoreOpen(true); return setError("O valor da mão de obra parece errado. Exemplo: 150,00."); }
    const items = draftsToItems(drafts);
    if (typeof items === "string") { setMoreOpen(true); return setError(items); }
    const km = mileage.trim() === "" ? null : Number(mileage.replace(/\D/g, ""));
    const yr = year.trim() === "" ? null : Number(year);
    if (yr !== null && !Number.isInteger(yr)) { setMoreOpen(true); return setError("O ano precisa ser um número, ex.: 2019."); }
    setBusy(true);
    const result = act((db, ctx) =>
      createOrder(db, ctx, {
        customer: customer ? { id: customer.id } : { name, phone },
        vehicle: vehicle ? { id: vehicle.id } : { plate, brand, model, year: yr, mileage: km },
        description,
        notes,
        mechanicId: mechanicId || null,
        laborCents,
        mileage: km,
        items,
        appointmentId: prefill.appointmentId ?? null,
      }),
    );
    setBusy(false);
    if (result.ok) {
      markBorn(result.value.id);
      toast("success", `${formatOrderNumber(result.value.number)} aberto com sucesso.`);
      onClose();
      openOrder(result.value.id);
    }
  };

  // Foco no campo principal de cada passo.
  const focusRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { const t = window.setTimeout(() => focusRef.current?.focus(), 60); return () => window.clearTimeout(t); }, [step, findByName]);

  const chooseCustomer = (id: string) => {
    setCustomerId(id);
    const cars = view.vehicles.filter((v) => v.customerId === id);
    if (cars.length === 1) { setVehicleId(cars[0].id); setPlate(formatPlate(cars[0].plate)); }
    else setVehicleId(null);
    setError(null);
  };

  const question: Record<StepKey, string> = {
    plate: findByName ? "Qual o nome do cliente?" : "Qual a placa do carro?",
    car: "Que carro é?",
    customer: "De quem é o carro?",
    work: "O que o cliente pediu?",
    who: "Quem vai fazer o serviço?",
    review: "Está tudo certo?",
  };

  const errId = `${uid}-err`;
  const fieldProps = (extra?: object) => ({ "aria-invalid": error ? true : undefined, "aria-describedby": error ? errId : undefined, ...extra });

  const body = (() => {
    switch (step) {
      case "plate":
        return findByName ? (
          <>
            <input ref={focusRef} id={`${uid}-name`} className="wiz-input" {...fieldProps()} value={name} onChange={(e) => { setName(e.target.value); setCustomerId(null); }} placeholder="" autoComplete="off" />
            <div className="wiz-list">
              {nameMatches.map((c) => {
                const cars = view.vehicles.filter((v) => v.customerId === c.id);
                return (
                  <div key={c.id} className="wiz-option-group">
                    <button type="button" className="wiz-option" data-on={customerId === c.id || undefined} onClick={() => chooseCustomer(c.id)}>
                      <UserRound aria-hidden /><span><b>{c.name}</b><small>{formatPhone(c.phone)}</small></span>
                    </button>
                    {customerId === c.id && cars.length > 1 && (
                      <div className="wiz-subopts" role="group" aria-label="Qual carro?">
                        {cars.map((v) => (
                          <button key={v.id} type="button" className="wiz-chip" aria-pressed={vehicleId === v.id} onClick={() => { setVehicleId(v.id); setPlate(formatPlate(v.plate)); }}>{vehicleLabel(v)} · {formatPlate(v.plate)}</button>
                        ))}
                        <button type="button" className="wiz-chip" aria-pressed={!vehicleId} onClick={() => { setVehicleId(null); setPlate(""); setFindByName(false); }}>Outro carro</button>
                      </div>
                    )}
                  </div>
                );
              })}
              {nameQuery.length >= 2 && nameMatches.length === 0 && <p className="wiz-hint">Nenhum cliente com esse nome. Volte e digite a placa para cadastrar.</p>}
            </div>
            <button type="button" className="wiz-link" onClick={() => { setFindByName(false); setError(null); }}><Search aria-hidden />Voltar para a placa</button>
          </>
        ) : (
          <>
            <div className="wiz-plate-frame" data-ok={normalized ? true : undefined}>
              <span className="wiz-plate-band" aria-hidden><i />BRASIL</span>
              <input ref={focusRef} id={`${uid}-plate`} className="wiz-plate" {...fieldProps()} value={plate} onChange={(e) => onPlate(maskPlate(e.target.value))} maxLength={8} autoComplete="off" spellCheck={false} placeholder="ABC1D23" />
            </div>
            <p className="wiz-hint">Pode digitar com ou sem traço. Exemplo: ABC1D23.</p>
            {vehicle && customer ? (
              <div className="wiz-found" role="status">
                <span className="wiz-found-icon"><CarFront aria-hidden /><Check className="wiz-found-check" aria-hidden /></span>
                <span><small>Achamos o carro</small><b>{vehicleLabel(vehicle)}</b><span>de {customer.name} · {formatPhone(customer.phone)}</span></span>
              </div>
            ) : normalized ? (
              <p className="wiz-new" role="status"><Sparkles aria-hidden />Carro novo por aqui. Vamos cadastrar em seguida.</p>
            ) : null}
            <button type="button" className="wiz-link" onClick={() => { setFindByName(true); setError(null); }}><Search aria-hidden />Não sabe a placa? Procurar pelo nome do cliente</button>
          </>
        );
      case "car":
        return (
          <>
            <label className="wiz-label" htmlFor={`${uid}-brand`}>Marca</label>
            <input ref={focusRef} id={`${uid}-brand`} className="wiz-input" {...fieldProps()} value={brand} onChange={(e) => setBrand(e.target.value)} autoComplete="off" />
            <div className="wiz-chips" role="group" aria-label="Marcas mais comuns">
              {BRAND_SUGGESTIONS.map((b) => <button key={b} type="button" className="wiz-chip" aria-pressed={brand === b} onClick={() => setBrand(b)}>{b}</button>)}
            </div>
            <label className="wiz-label" htmlFor={`${uid}-model`}>Modelo</label>
            <input id={`${uid}-model`} className="wiz-input" {...fieldProps()} value={model} onChange={(e) => setModel(e.target.value)} autoComplete="off" />
            <details className="wiz-more">
              <summary>Mais detalhes (opcional): ano e quilometragem</summary>
              <div className="wiz-two">
                <label className="wiz-label-sm">Ano<input className="wiz-input-sm" inputMode="numeric" maxLength={4} value={year} onChange={(e) => setYear(maskDigits(e.target.value, 4))} /></label>
                <label className="wiz-label-sm">Quilometragem<input className="wiz-input-sm" inputMode="numeric" value={mileage} onChange={(e) => setMileage(maskDigits(e.target.value, 7))} /></label>
              </div>
            </details>
          </>
        );
      case "customer":
        return (
          <>
            <label className="wiz-label" htmlFor={`${uid}-cname`}>Nome do cliente</label>
            <div className="wiz-with-avatar">
              <span className="wiz-avatar is-big" data-empty={!name.trim() || undefined} aria-hidden>{name.trim() ? initials(name) : <UserRound />}</span>
              <input ref={focusRef} id={`${uid}-cname`} className="wiz-input" {...fieldProps()} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
            </div>
            {nameMatches.length > 0 && (
              <div className="wiz-list" aria-label="Clientes já cadastrados com esse nome">
                <p className="wiz-hint">Já é cliente? Toque no nome:</p>
                {nameMatches.map((c) => (
                  <button key={c.id} type="button" className="wiz-option" onClick={() => { setCustomerId(c.id); setError(null); }}>
                    <UserRound aria-hidden /><span><b>{c.name}</b><small>{formatPhone(c.phone)}</small></span>
                  </button>
                ))}
              </div>
            )}
            <label className="wiz-label" htmlFor={`${uid}-phone`}>Telefone (WhatsApp)</label>
            <input id={`${uid}-phone`} className="wiz-input" {...fieldProps()} inputMode="tel" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} autoComplete="off" />
            <p className="wiz-hint">Com DDD. Exemplo: (85) 98888-7777.</p>
          </>
        );
      case "work":
        return (
          <>
            <input ref={focusRef} id={`${uid}-work`} className="wiz-input" {...fieldProps()} value={description} onChange={(e) => setDescription(e.target.value)} autoComplete="off" />
            <p className="wiz-hint">Escreva com suas palavras, ou toque numa sugestão:</p>
            <div className="wiz-tiles" role="group" aria-label="Sugestões">
              {SERVICE_SUGGESTIONS.map(([label, Icon]) => (
                <button key={label} type="button" className="wiz-tile" aria-pressed={description === label} onClick={() => { setDescription(label); setError(null); }}>
                  <Icon aria-hidden /><span>{label}</span>
                </button>
              ))}
            </div>
          </>
        );
      case "who":
        return (
          <div className="wiz-people" role="radiogroup" aria-labelledby={`${uid}-q`}>
            {mechanics.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={mechanicId === m.id} className="wiz-person" onClick={() => { setMechanicId(m.id); setError(null); }}>
                <span className="wiz-avatar">{initials(m.name)}</span>
                <span className="wiz-person-text"><b>{m.name}</b><small>{(() => { const n = view.orders.filter((o) => !o.cancelledAt && o.status !== "done" && o.mechanicId === m.id).length; return n === 0 ? "Livre agora" : `${n} ${n === 1 ? "carro" : "carros"} agora`; })()}</small></span>
                {mechanicId === m.id && <Check className="wiz-person-check" aria-hidden />}
              </button>
            ))}
            <button type="button" role="radio" aria-checked={mechanicId === null} className="wiz-person is-later" onClick={() => { setMechanicId(null); setError(null); }}>
              <span className="wiz-avatar"><Wrench aria-hidden /></span>
              <span className="wiz-person-text"><b>Ainda não sei</b><small>Decide depois</small></span>
              {mechanicId === null && <Check className="wiz-person-check" aria-hidden />}
            </button>
          </div>
        );
      case "review": {
        const rows: [string, string, StepKey][] = [
          ["Carro", vehicle ? `${vehicleLabel(vehicle)} · ${formatPlate(vehicle.plate)}` : `${brand} ${model} · ${normalized ? formatPlate(normalized) : plate}`, needsCar ? "car" : "plate"],
          ["Cliente", customer ? `${customer.name} · ${formatPhone(customer.phone)}` : `${name} · ${normalizePhone(phone) ? formatPhone(normalizePhone(phone)!) : phone}`, needsCustomer ? "customer" : "plate"],
          ["O que fazer", description, "work"],
          ["Quem faz", mechanicId ? mechanics.find((m) => m.id === mechanicId)?.name ?? "" : "Ainda não definido", "who"],
        ];
        const carLabel = vehicle ? vehicleLabel(vehicle) : `${brand} ${model}`.trim();
        const plateLabel = vehicle ? formatPlate(vehicle.plate) : normalized ? formatPlate(normalized) : plate;
        const who = customer?.name ?? name;
        const mech = mechanicId ? mechanics.find((m) => m.id === mechanicId)?.name.split(" ").slice(0, 2).join(" ") : "Sem responsável";
        return (
          <>
            <div className="wiz-preview" aria-label="Como o serviço vai aparecer no quadro">
              <span className="wiz-preview-tag"><span className="wiz-dot" />Vai entrar em Aguardando</span>
              <div className="wiz-preview-card">
                <span className="wiz-preview-top"><b>Serviço novo</b><span>{laborCents === null && partsTotal === 0 ? "Valor a definir" : formatBRL((laborCents ?? 0) + partsTotal)}</span></span>
                <span className="wiz-preview-name">{who}</span>
                <span className="wiz-preview-car">{carLabel} <span className="vehicle-plate">{plateLabel}</span></span>
                <span className="wiz-preview-desc">{description}</span>
                <span className="wiz-preview-foot"><UserRound aria-hidden />{mech}</span>
              </div>
            </div>
            <dl className="wiz-review">
              {rows.map(([label, value, target]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd className="wiz-review-value">
                    <span>{value}</span>
                    <button type="button" className="wiz-edit" onClick={() => goTo(steps.indexOf(target))} aria-label={`Alterar ${label.toLowerCase()}`}><Pencil aria-hidden />Alterar</button>
                  </dd>
                </div>
              ))}
            </dl>
            <details className="wiz-more" open={moreOpen} onToggle={(e) => setMoreOpen((e.target as HTMLDetailsElement).open)}>
              <summary>Mais detalhes (opcional): valor, peças e observações</summary>
              <fieldset className="wiz-labor">
                <legend>Mão de obra</legend>
                <div className="wiz-chips">
                  <button type="button" className="wiz-chip" aria-pressed={laborMode === "later"} onClick={() => setLaborMode("later")}>Ainda não sei o valor</button>
                  <button type="button" className="wiz-chip" aria-pressed={laborMode === "value"} onClick={() => setLaborMode("value")}>Já sei o valor</button>
                  <button type="button" className="wiz-chip" aria-pressed={laborMode === "free"} onClick={() => setLaborMode("free")}>Não vai cobrar</button>
                </div>
                {laborMode === "value" && (
                  <label className="wiz-label-sm">Quanto? (R$)<input className="wiz-input-sm" inputMode="decimal" value={labor} onChange={(e) => setLabor(maskMoney(e.target.value))} autoFocus /></label>
                )}
              </fieldset>
              <div className="wiz-parts">
                <p className="wiz-label-sm">Peças já usadas (saem do estoque ao abrir)</p>
                <PartsEditor drafts={drafts} onChange={setDrafts} />
              </div>
              {vehicle && <label className="wiz-label-sm">Quilometragem de hoje<input className="wiz-input-sm" inputMode="numeric" value={mileage} onChange={(e) => setMileage(maskDigits(e.target.value, 7))} /></label>}
              <label className="wiz-label-sm">Observações<textarea className="wiz-input-sm" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
            </details>
            {(laborCents !== null || partsTotal > 0) && (
              <p className="wiz-total">Total até agora: <b>{formatBRL((laborCents ?? 0) + partsTotal)}</b>{laborCents === null && " + mão de obra"}</p>
            )}
          </>
        );
      }
    }
  })();

  return (
    <Dialog
      className="wiz-dialog"
      title="Novo serviço"
      subtitle={prefill.appointmentId ? "Veio do agendamento: confira e continue." : undefined}
      size="md"
      onClose={onClose}
      footer={
        <>
          <Button className="mr-auto" icon={<ArrowLeft className="size-4" aria-hidden />} onClick={back}>{stepIndex === 0 ? "Cancelar" : "Voltar"}</Button>
          <Button variant="primary" className="wiz-next" loading={busy} disabled={step === "review" && !online} onClick={next}>
            {step === "review" ? "Abrir serviço" : "Continuar"}{step !== "review" && <ArrowRight className="size-4" aria-hidden />}
          </Button>
        </>
      }
    >
      <form className="wiz" onInput={() => { if (error) setError(null); }} onSubmit={(e) => { e.preventDefault(); next(); }}>
        <ol className="wiz-stepper" aria-label={`Passo ${position} de ${steps.length}`}>
          {steps.map((s, i) => {
            const { label, icon: Icon } = STEP_META[s];
            const state = i < position - 1 ? "done" : i === position - 1 ? "now" : "next";
            return (
              <li key={s} data-state={state} aria-current={state === "now" ? "step" : undefined}>
                <span className="wiz-stepper-dot">{state === "done" ? <Check aria-hidden /> : <Icon aria-hidden />}</span>
                <span className="wiz-stepper-label">{label}</span>
              </li>
            );
          })}
        </ol>
        <div key={`${step}-${findByName}`} className="wiz-step" data-dir={dir}>
          {step === "plate" || step === "work" ? (
            <label id={`${uid}-q`} className="wiz-q" htmlFor={findByName ? `${uid}-name` : step === "plate" ? `${uid}-plate` : `${uid}-work`}>{question[step]}</label>
          ) : (
            <h3 id={`${uid}-q`} className="wiz-q">{question[step]}</h3>
          )}
          {body}
          {error && <p id={errId} className="wiz-error" role="alert">{error}</p>}
        </div>
        <button type="submit" hidden tabIndex={-1} aria-hidden />
      </form>
    </Dialog>
  );
}
