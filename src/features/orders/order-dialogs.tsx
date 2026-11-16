"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/app-state/app-context";
import { Dialog } from "@/components/ui/dialog";
import { Button, cx, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/domain/labels";
import type { ID, PaymentMethod, ServiceOrder } from "@/domain/types";
import { centsToInput, formatBRL, formatOrderNumber, formatPhone, formatPlate, normalizePhone, parseBRL } from "@/lib/format";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { cancelOrder, orderTotals, registerPayment, updateOrder } from "@/services/orders";
import { vehicleLabel } from "./shared";

export function PaymentMethodPicker({ value, onChange }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void }) {
  return (
    <div role="group" aria-label="Forma de pagamento" className="grid grid-cols-2 gap-2">
      {PAYMENT_METHODS.map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={value === m}
          onClick={() => onChange(m)}
          className={cx(
            "min-h-11 rounded-md border px-2 text-sm font-medium",
            value === m ? "border-primary bg-primary-soft text-primary" : "border-line hover:bg-slate-50",
          )}
        >
          {PAYMENT_METHOD_LABELS[m]}
        </button>
      ))}
    </div>
  );
}

export function PaymentDialog({ orderId, onClose }: { orderId: ID; onClose: () => void }) {
  const { view, act, customerOf, vehicleOf, online } = useApp();
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [busy, setBusy] = useState(false);
  const order = view.orders.find((o) => o.id === orderId);
  if (!order) return null;
  const totals = orderTotals(view, order);
  const vehicle = vehicleOf(order.vehicleId);

  return (
    <Dialog
      title="Registrar pagamento"
      subtitle={`${formatOrderNumber(order.number)} · ${customerOf(order.customerId)?.name} · ${vehicleLabel(vehicle)} ${vehicle ? formatPlate(vehicle.plate) : ""}`}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Voltar</Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!online}
            onClick={() => {
              if (busy) return;
              setBusy(true);
              const r = act((db, ctx) => registerPayment(db, ctx, order.id, { method }), "Pagamento registrado. A receita já consta no financeiro.");
              setBusy(false);
              if (r.ok) onClose();
            }}
          >
            Confirmar recebimento de {formatBRL(totals.totalCents)}
          </Button>
        </>
      }
    >
      <dl className="mb-4 space-y-1 text-sm">
        <div className="flex justify-between"><dt className="text-muted">Mão de obra</dt><dd>{formatBRL(totals.laborCents ?? 0)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Peças</dt><dd>{formatBRL(totals.partsCents)}</dd></div>
        <div className="flex justify-between border-t border-line pt-1 text-base font-semibold"><dt>Total a receber</dt><dd>{formatBRL(totals.totalCents)}</dd></div>
      </dl>
      <p className="mb-2 text-sm font-medium">Forma de pagamento</p>
      <PaymentMethodPicker value={method} onChange={setMethod} />
      <p className="mt-3 text-xs text-muted">O pagamento é integral e registrado manualmente. Não há cobrança automática nem pagamento parcial.</p>
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
          {(p) => <Input {...p} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className="max-w-56" />}
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
  const [labor, setLabor] = useState(centsToInput(order.laborCents));
  const [mileage, setMileage] = useState(order.mileage?.toString() ?? "");
  const [notes, setNotes] = useState(order.notes);
  const laborCents = labor.trim() === "" ? null : parseBRL(labor);
  const laborInvalid = labor.trim() !== "" && laborCents === null;

  const save = () => {
    if (laborInvalid) return toast("error", "Valor de mão de obra inválido. Use o formato 150,00.");
    const km = mileage.trim() === "" ? null : Number(mileage);
    if (km !== null && !Number.isInteger(km)) return toast("error", "Quilometragem deve ser um número inteiro.");
    const r = act(
      (db, ctx) => updateOrder(db, ctx, order.id, { description, notes, mechanicId: mechanicId || null, laborCents, mileage: km }),
      "OS atualizada.",
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
      <div className="grid grid-cols-2 gap-3">
        <Field label="Descrição do serviço" className="col-span-2">
          {(p) => <Input {...p} value={description} onChange={(e) => setDescription(e.target.value)} />}
        </Field>
        <Field label="Mecânico responsável" optional>
          {(p) => (
            <Select {...p} value={mechanicId} onChange={(e) => setMechanicId(e.target.value)}>
              <option value="">A definir</option>
              {mechanics.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          label="Mão de obra (R$)"
          optional
          error={laborInvalid ? "Valor inválido. Ex.: 150,00" : undefined}
          hint={order.paymentId ? "OS paga: o valor não pode ser alterado." : "Em branco = a definir. 0 = serviço gratuito."}
        >
          {(p) => <Input {...p} value={labor} onChange={(e) => setLabor(e.target.value)} inputMode="decimal" disabled={!!order.paymentId} placeholder="A definir" />}
        </Field>
        <Field label="Quilometragem" optional>
          {(p) => <Input {...p} value={mileage} onChange={(e) => setMileage(e.target.value)} inputMode="numeric" />}
        </Field>
        <Field label="Observações" optional className="col-span-2">
          {(p) => <Textarea {...p} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
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
          <Button onClick={onClose}>Manter OS</Button>
          <Button
            variant="danger"
            disabled={!online}
            onClick={() => {
              const r = act((db, ctx) => cancelOrder(db, ctx, order.id, { reason, returnParts: hasParts && returnParts }), "OS cancelada.");
              if (r.ok) onClose();
            }}
          >
            Cancelar OS
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm">A OS sairá do quadro e ficará disponível apenas para consulta. Esta ação não pode ser desfeita.</p>
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
