"use client";

import { ArrowRightLeft, Banknote, Check, CreditCard, Nfc, Smartphone } from "lucide-react";
import { useId } from "react";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/domain/labels";
import type { PaymentMethod } from "@/domain/types";
import { formatBRL, parseBRL } from "@/lib/format";
import { maskMoney } from "@/lib/masks";

/**
 * Janela "Receber": um desenho da forma de pagamento escolhida (cartão, cédulas,
 * celular do PIX, comprovante de transferência) com o valor e o nome do cliente.
 * É só ilustração: o sistema não cobra nada e não pede dados de cartão.
 * Desenhos genéricos, sem marcas reais, na cor da oficina.
 */

const ICONS: Record<PaymentMethod, typeof Banknote> = { cash: Banknote, pix: Smartphone, card: CreditCard, transfer: ArrowRightLeft };
const HINT: Record<PaymentMethod, string> = {
  cash: "Notas e moedas",
  pix: "Pelo celular",
  card: "Débito ou crédito",
  transfer: "TED ou depósito",
};

/** Botões grandes para escolher a forma (rádios de verdade: setas do teclado funcionam). */
export function PaymentMethodTiles({ value, onChange, legend = "Como o cliente pagou?" }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void; legend?: string }) {
  const name = useId();
  return (
    <fieldset className="pay-tiles">
      <legend className="pay-legend">{legend}</legend>
      <div className="pay-tiles-grid">
        {PAYMENT_METHODS.map((m) => {
          const Icon = ICONS[m];
          return (
            <label key={m} className="pay-tile" data-checked={value === m || undefined}>
              <input type="radio" name={name} value={m} checked={value === m} onChange={() => onChange(m)} className="sr-only" />
              <Icon className="pay-tile-icon" aria-hidden />
              <span className="pay-tile-label">{PAYMENT_METHOD_LABELS[m]}</span>
              <span className="pay-tile-hint">{HINT[m]}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** "Francisco das Chagas Moura" → "Francisco Moura" (cabe no cartão sem cortar). */
function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1]}` : full;
}

function Card({ amount, who, workshop }: { amount: string; who: string; workshop: string }) {
  return (
    <div className="pay-card">
      <div className="pay-card-top">
        <svg className="pay-chip" viewBox="0 0 40 30" aria-hidden>
          <rect x="1" y="1" width="38" height="28" rx="5" />
          <path d="M1 10h12M1 20h12M27 10h12M27 20h12M13 1v28M27 1v28M13 15h14" />
        </svg>
        <span className="pay-card-brand">{workshop}</span>
        <Nfc className="pay-card-nfc" aria-hidden />
      </div>
      <div className="pay-card-amount">{amount}</div>
      <div className="pay-card-bottom">
        <span className="pay-card-name">{shortName(who)}</span>
      </div>
    </div>
  );
}

function Cash({ amount }: { amount: string }) {
  return (
    <div className="pay-cash">
      {[0, 1, 2].map((i) => (
        <div key={i} className="pay-note" style={{ ["--n" as string]: i }}>
          <span className="pay-note-seal" />
          <span className="pay-note-value">R$</span>
          <span className="pay-note-lines" />
        </div>
      ))}
      <span className="pay-cash-amount">{amount}</span>
    </div>
  );
}

function Pix({ amount }: { amount: string }) {
  return (
    <div className="pay-phone">
      <span className="pay-phone-notch" />
      <div className="pay-phone-screen">
        <svg className="pay-phone-check" viewBox="0 0 52 52" aria-hidden><circle cx="26" cy="26" r="24" /><path d="M15 27 l8 8 l15 -17" /></svg>
        <span className="pay-phone-title">Pix recebido</span>
        <span className="pay-phone-amount">{amount}</span>
      </div>
    </div>
  );
}

function Transfer({ amount, who }: { amount: string; who: string }) {
  return (
    <div className="pay-receipt">
      <span className="pay-receipt-head"><Check className="size-3.5" aria-hidden /> Transferência recebida</span>
      <span className="pay-receipt-amount">{amount}</span>
      <span className="pay-receipt-line"><b>De</b> {who}</span>
      <span className="pay-receipt-line"><b>Data</b> {new Date().toLocaleDateString("pt-BR")}</span>
    </div>
  );
}

/** O desenho da forma escolhida. Troca com animação curta; com movimento reduzido fica parado. */
export function PaymentStage({ method, amountCents, customerName, workshopName }: { method: PaymentMethod; amountCents: number; customerName: string; workshopName: string }) {
  const amount = formatBRL(amountCents);
  const who = customerName || "Cliente";
  return (
    <div className="pay-stage" aria-hidden>
      <div key={method} className="pay-stage-item" data-method={method}>
        {method === "card" && <Card amount={amount} who={who} workshop={workshopName} />}
        {method === "cash" && <Cash amount={amount} />}
        {method === "pix" && <Pix amount={amount} />}
        {method === "transfer" && <Transfer amount={amount} who={who} />}
      </div>
    </div>
  );
}

/** Sugestões de valor entregue: exato e as próximas notas redondas acima do total. */
function suggestions(totalCents: number): number[] {
  const out = new Set<number>([totalCents]);
  for (const step of [1000, 5000, 10000]) {
    const up = Math.ceil(totalCents / step) * step;
    if (up > totalCents) out.add(up);
  }
  return [...out].sort((a, b) => a - b).slice(0, 4);
}

/** Dinheiro: quanto o cliente entregou e o troco. Só ajuda na conta; não grava nada novo. */
export function CashChange({ totalCents, given, onGiven }: { totalCents: number; given: string; onGiven: (v: string) => void }) {
  const id = useId();
  const cents = given.trim() === "" ? null : parseBRL(given);
  const change = cents === null ? null : cents - totalCents;
  return (
    <div className="pay-change">
      <label htmlFor={id} className="pay-change-label">Quanto o cliente entregou? <span>(opcional, para calcular o troco)</span></label>
      <div className="pay-change-row">
        <div className="pay-change-input">
          <span aria-hidden>R$</span>
          <input id={id} inputMode="decimal" placeholder="0,00" value={given} onChange={(e) => onGiven(maskMoney(e.target.value))} aria-describedby={`${id}-r`} />
        </div>
        <div className="pay-change-chips" role="group" aria-label="Valores rápidos">
          {suggestions(totalCents).map((v) => (
            <button key={v} type="button" onClick={() => onGiven((v / 100).toFixed(2).replace(".", ","))}>{v === totalCents ? "Exato" : formatBRL(v).replace(",00", "")}</button>
          ))}
        </div>
      </div>
      <p id={`${id}-r`} className="pay-change-result" data-state={change === null ? "empty" : change < 0 ? "short" : "ok"} aria-live="polite">
        {change === null ? "Digite o valor ou toque num atalho." : change < 0 ? `Faltam ${formatBRL(-change)}` : change === 0 ? "Sem troco" : <>Troco <strong>{formatBRL(change)}</strong></>}
      </p>
    </div>
  );
}

/** Valor entregue menor que o total impede marcar como recebido (pagamento é integral). */
export function cashShort(totalCents: number, given: string): boolean {
  if (given.trim() === "") return false;
  const c = parseBRL(given);
  return c !== null && c < totalCents;
}
