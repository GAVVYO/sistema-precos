"use client";

import { celebratePayment } from "@/lib/celebrate";
import { withTransition } from "@/lib/view-transition";
import { CashChange, cashShort, PaymentMethodTiles, PaymentStage } from "./payment-stage";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/app-state/app-context";
import { ChoiceGroup, MoreDetails } from "@/components/ui/choice";
import { Dialog } from "@/components/ui/dialog";
import { Button, Field, Input, Textarea } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import type { ID, PaymentMethod, ServiceOrder } from "@/domain/types";
import { centsToInput, formatBRL, formatOrderNumber, formatPhone, formatPlate, normalizePhone, parseBRL } from "@/lib/format";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { orderTotals } from "@/services/orders";
import { vehicleLabel } from "./shared";
import { maskDigits, maskMoney, maskPhone } from "@/lib/masks";

/** Escolha da forma de pagamento (botões grandes com ícone). */
export function PaymentMethodPicker({ value, onChange, legend = "Forma de pagamento" }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void; legend?: string }) {
  return <PaymentMethodTiles value={value} onChange={onChange} legend={legend} />;
}

export function PaymentDialog({ orderId, onClose }: { orderId: ID; onClose: () => void }) {
  const { view, act, customerOf, vehicleOf, online, settings } = useApp();
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [given, setGiven] = useState("");
  const [busy, setBusy] = useState(false);
  const order = view.orders.find((o) => o.id === orderId);
  if (!order) return null;
  const totals = orderTotals(view, order);
  const vehicle = vehicleOf(order.vehicleId);

  return (
    <Dialog
      title="Receber"
      subtitle={`${formatOrderNumber(order.number)} · ${customerOf(order.customerId)?.name} · ${vehicleLabel(vehicle)} ${vehicle ? formatPlate(vehicle.plate) : ""}`}
      size="md"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Voltar</Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!online || (method === "cash" && cashShort(totals.totalCents, given))}
            onClick={(e) => {
              if (busy) return;
              setBusy(true);
              const from = e.currentTarget.getBoundingClientRect();
              const amount = formatBRL(totals.totalCents);
              // A linha de "Quem falta pagar" sai com brilho verde e as outras sobem.
              withTransition("pay", () => {
                const r = act((c) => c.registerPayment(order.id, { method }), `Recebido ${amount} do ${formatOrderNumber(order.number)}. O valor já aparece no Financeiro.`);
                setBusy(false);
                if (r.ok) { onClose(); celebratePayment(from, amount); }
              });
            }}
          >
            Recebi {formatBRL(totals.totalCents)}
          </Button>
        </>
      }
    >
      <PaymentStage method={method} amountCents={totals.totalCents} customerName={customerOf(order.customerId)?.name ?? ""} workshopName={settings.displayName} />
      <dl className="pay-summary">
        <div><dt>Mão de obra</dt><dd>{formatBRL(totals.laborCents ?? 0)}</dd></div>
        <div><dt>Peças</dt><dd>{formatBRL(totals.partsCents)}</dd></div>
        <div className="is-total"><dt>Total a receber</dt><dd>{formatBRL(totals.totalCents)}</dd></div>
      </dl>
      <PaymentMethodTiles value={method} onChange={setMethod} />
      {method === "cash" && <CashChange totalCents={totals.totalCents} given={given} onGiven={setGiven} />}
      <p className="pay-note-text">Só marque depois de receber o valor inteiro. O sistema não cobra o cliente sozinho.</p>
    </Dialog>
  );
}

/** Revisão do texto antes de abrir o WhatsApp. Não envia nem confirma entrega. */
export function WhatsAppDialog({
  title,
  phone: initialPhone,
  text: initialText,
  onClose,
}: {
  title: string;
  phone: string;
  text: string;
  onClose: () => void;
}) {
  const [phone, setPhone] = useState(formatPhone(initialPhone));
  const [text, setText] = useState(initialText);
  const valid = normalizePhone(phone) !== null;

  return (
    <Dialog
      title={title}
      subtitle="Revise a mensagem. Ela será aberta no WhatsApp para você enviar."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Fechar</Button>
          <Button
            variant="primary"
            icon={<ExternalLink className="size-4" aria-hidden />}
            disabled={!valid || text.trim() === ""}
            onClick={() => {
              const url = buildWhatsAppUrl(phone, text);
              if (!url) return toast("error", "Telefone inválido para WhatsApp.");
              window.open(url, "_blank", "noopener,noreferrer");
              onClose();
            }}
          >
            Abrir no WhatsApp
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Telefone do cliente" error={valid ? undefined : "Telefone inválido. Use DDD + número, ex.: (85) 98888-7777."}>
          {(p) => <Input {...p} value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} inputMode="tel" className="max-w-56" />}
        </Field>
        <Field label="Mensagem" hint="O sistema apenas abre a conversa com o texto preenchido; o envio é feito por você e não há confirmação de entrega.">
          {(p) => <Textarea {...p} rows={11} value={text} onChange={(e) => setText(e.target.value)} />}
        </Field>
      </div>
    </Dialog>
  );
}

export function EditOrderDialog({ order, onClose }: { order: ServiceOrder; onClose: () => void }) {
  const { act, mechanics, online } = useApp();
  const [description, setDescription] = useState(order.description);
  const [mechanicId, setMechanicId] = useState(order.mechanicId ?? "");
  const [labor, setLabor] = useState(order.laborCents ? centsToInput(order.laborCents) : "");
  const [laborMode, setLaborMode] = useState<"later" | "value" | "free">(order.laborCents === null ? "later" : order.laborCents === 0 ? "free" : "value");
  const [mileage, setMileage] = useState(order.mileage?.toString() ?? "");
  const [notes, setNotes] = useState(order.notes);
  const laborCents = laborMode === "later" ? null : laborMode === "free" ? 0 : labor.trim() === "" ? null : parseBRL(labor);
  const laborInvalid = laborMode === "value" && (labor.trim() === "" || laborCents === null);

  const save = () => {
    if (laborInvalid) return toast("error", "Escreva o valor da mão de obra. Ex.: 150,00");
    const km = mileage.trim() === "" ? null : Number(mileage);
    if (km !== null && !Number.isInteger(km)) return toast("error", "Quilometragem deve ser um número inteiro.");
    const r = act(
      (c) => c.updateOrder(order.id, { description, notes, mechanicId: mechanicId || null, laborCents, mileage: km }),
      "Serviço atualizado.",
    );
    if (r.ok) onClose();
  };

  return (
    <Dialog
      title={`Editar ${formatOrderNumber(order.number)}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={!online} onClick={save}>
            Salvar alterações
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="O que vai ser feito?">
          {(p) => <Input {...p} value={description} onChange={(e) => setDescription(e.target.value)} />}
        </Field>
        <ChoiceGroup
          label="Quem vai fazer?"
          value={mechanicId}
          onChange={setMechanicId}
          options={[{ value: "", label: "Ainda não sei" }, ...mechanics.map((m) => ({ value: m.id, label: m.name }))]}
        />
        {order.paymentId ? (
          <p className="choice-help">Serviço já pago: a mão de obra não pode mudar.</p>
        ) : (
          <>
            <ChoiceGroup
              label="Quanto vai cobrar de mão de obra?"
              value={laborMode}
              onChange={setLaborMode}
              columns={3}
              options={[
                { value: "value", label: "Já sei o valor" },
                { value: "later", label: "Ainda não sei" },
                { value: "free", label: "Não vai cobrar" },
              ]}
            />
            {laborMode === "value" && (
              <Field label="Valor da mão de obra (R$)" error={labor.trim() !== "" && laborCents === null ? "Valor inválido. Ex.: 150,00" : undefined}>
                {(p) => <Input {...p} value={labor} onChange={(e) => setLabor(maskMoney(e.target.value))} inputMode="decimal" autoFocus />}
              </Field>
            )}
          </>
        )}
        <MoreDetails summary="Mais detalhes (opcional): quilometragem e observações" defaultOpen={!!order.notes || order.mileage !== null}>
          <Field label="Quilometragem" optional>
            {(p) => <Input {...p} value={mileage} onChange={(e) => setMileage(maskDigits(e.target.value, 7))} inputMode="numeric" />}
          </Field>
          <Field label="Observações" optional>
            {(p) => <Textarea {...p} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />}
          </Field>
        </MoreDetails>
      </div>
    </Dialog>
  );
}

export function CancelOrderDialog({ order, hasParts, onClose }: { order: ServiceOrder; hasParts: boolean; onClose: () => void }) {
  const { act, online } = useApp();
  const [reason, setReason] = useState("");
  const [returnParts, setReturnParts] = useState(true);
  return (
    <Dialog
      title={`Cancelar ${formatOrderNumber(order.number)}`}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Não cancelar</Button>
          <Button
            variant="danger"
            disabled={!online}
            onClick={() => {
              const r = act((c) => c.cancelOrder(order.id, { reason, returnParts: hasParts && returnParts }), "Serviço cancelado.");
              if (r.ok) onClose();
            }}
          >
            Cancelar serviço
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm">O serviço sai do quadro e fica só para consulta. Esta ação não pode ser desfeita.</p>
      <Field label="Motivo do cancelamento">
        {(p) => <Textarea {...p} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />}
      </Field>
      {hasParts && (
        <label className="mt-3 flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 accent-(--primary)" checked={returnParts} onChange={(e) => setReturnParts(e.target.checked)} />
          <span>
            Devolver as peças ao estoque
            <span className="block text-xs text-muted">Desmarque se as peças já foram instaladas ou inutilizadas.</span>
          </span>
        </label>
      )}
    </Dialog>
  );
}
