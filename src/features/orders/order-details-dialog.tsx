"use client";

import { OrderPhotos } from "./order-photos";
import { Check, CurrencyCircleDollar, FilePdf, Gauge, HourglassMedium, Money, NoteBlank, PencilSimple, Phone, Plus, Prohibit, Receipt, SealCheck, WhatsappLogo, Wrench } from "@phosphor-icons/react";
import { useState } from "react";
import { useApp } from "@/app-state/app-context";
import { ReadableText } from "@/components/accessibility/accessibility-controls";
import { ChoiceGroup } from "@/components/ui/choice";
import { Dialog } from "@/components/ui/dialog";
import { Button, Field, Input, Textarea } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { ORDER_STATUS_LABELS, ORDER_STATUSES, PAYMENT_METHOD_LABELS } from "@/domain/labels";
import type { ID, OrderStatus } from "@/domain/types";
import { MiniPlate } from "@/features/dashboard/yard";
import { exportOrderPdf } from "@/lib/export";
import { addDays, dateOf, formatBRL, formatBRLOrPending, formatDateTime, formatOrderNumber, formatPhone, formatPlate, formatTime, parseBRL, todayISO } from "@/lib/format";
import { quoteMessage, statusMessage } from "@/lib/whatsapp";
import { canChangeStatus, orderTotals, PAYMENT_SITUATION_LABELS, paymentSituation, setOrderItems } from "@/services/orders";
import { useMoveOrder } from "./move-order";
import { useOrderActions } from "./order-actions";
import { CancelOrderDialog, EditOrderDialog, PaymentDialog, WhatsAppDialog } from "./order-dialogs";
import { QuickOrderAction } from "./quick-order-action";
import { DraftItem, draftsToItems, orderTotalText, PartsEditor, toDrafts, vehicleLabel } from "./shared";
import { maskMoney } from "@/lib/masks";

/** "hoje às 14:43", "ontem às 9:10", "em 13/11 às 8:00". */
function sinceWhen(at: string): string {
  const d = dateOf(at);
  const today = todayISO();
  const day = d === today ? "hoje" : d === addDays(today, -1) ? "ontem" : `em ${formatDateTime(at).slice(0, 5)}`;
  return `${day} às ${formatTime(at)}`;
}

type Sub = null | "edit" | "pay" | "cancel" | "quote" | "update";

export function OrderDetailsDialog({ orderId, onClose }: { orderId: ID; onClose: () => void }) {
  const { db, view, act, can, online, user, settings, mechanics, customerOf, vehicleOf, userOf, partOf } = useApp();
  const [sub, setSub] = useState<Sub>(null);
  const [drafts, setDrafts] = useState<DraftItem[] | null>(null);
  const [correction, setCorrection] = useState("");
  const [exporting, setExporting] = useState(false);
  const [pickMech, setPickMech] = useState(false);
  const [laborDraft, setLaborDraft] = useState<string | null>(null);
  const { assign, setLabor } = useOrderActions();
  const moveOrder = useMoveOrder();

  const order = view.orders.find((o) => o.id === orderId);
  if (!order) return null;

  const customer = customerOf(order.customerId);
  const vehicle = vehicleOf(order.vehicleId);
  const items = view.orderItems.filter((i) => i.orderId === order.id);
  const totals = orderTotals(view, order);
  const situation = paymentSituation(order, totals);
  const payment = view.payments.find((p) => p.id === order.paymentId);
  const events = view.orderEvents.filter((e) => e.orderId === order.id).sort((a, b) => b.at.localeCompare(a.at));
  const cancelled = !!order.cancelledAt;
  const locked = cancelled || !!order.paymentId;
  const ctx = { workshopId: order.workshopId, userId: user.id };
  const canEditParts = (can("os.parts") || can("os.edit")) && !locked;
  const number = formatOrderNumber(order.number);

  const saveParts = () => {
    const parsed = draftsToItems(drafts ?? []);
    if (typeof parsed === "string") return toast("error", parsed);
    const r = act((d, c) => setOrderItems(d, c, order.id, parsed, correction), "Peças atualizadas e estoque ajustado.");
    if (r.ok) {
      setDrafts(null);
      setCorrection("");
    }
  };

  const downloadPdf = async () => {
    setExporting(true);
    try {
      await exportOrderPdf(
        {
          number,
          kind: order.status === "done" || order.paymentId ? "Serviço" : "Orçamento",
          status: cancelled ? "Cancelado" : ORDER_STATUS_LABELS[order.status],
          payment: PAYMENT_SITUATION_LABELS[situation],
          openedAt: formatDateTime(order.openedAt),
          customer: customer?.name ?? "",
          phone: customer ? formatPhone(customer.phone) : "",
          vehicle: vehicleLabel(vehicle),
          plate: vehicle ? formatPlate(vehicle.plate) : "",
          mileage: order.mileage ? `${order.mileage.toLocaleString("pt-BR")} km` : "",
          mechanic: userOf(order.mechanicId)?.name ?? "A definir",
          description: order.description,
          notes: order.notes,
          items: items.map((i) => ({
            name: partOf(i.partId)?.name ?? "Peça removida",
            quantity: i.quantity,
            unit: formatBRL(i.unitPriceCents),
            subtotal: formatBRL(i.quantity * i.unitPriceCents),
          })),
          labor: formatBRLOrPending(totals.laborCents),
          parts: formatBRL(totals.partsCents),
          total: orderTotalText(totals),
        },
        { workshopName: settings.displayName, logoDataUrl: settings.logoDataUrl, primaryColor: settings.primaryColor },
      );
      toast("success", "PDF gerado.");
    } catch (e) {
      console.error(e);
      toast("error", "Não foi possível gerar o PDF. Tente novamente.");
    }
    setExporting(false);
  };

  const whatsappBase = {
    customerName: customer?.name ?? "",
    workshopName: settings.displayName,
    vehicle: vehicleLabel(vehicle),
    plate: vehicle?.plate ?? "",
  };

  const mechanicName = userOf(order.mechanicId)?.name;
  const paidStep = situation === "paid" || situation === "free";
  const steps: { key: OrderStatus | "paid"; label: string; Icon: typeof Wrench }[] = [
    { key: "waiting", label: "Aguardando", Icon: HourglassMedium },
    { key: "in_progress", label: "Em andamento", Icon: Wrench },
    { key: "done", label: "Pronto", Icon: SealCheck },
    { key: "paid", label: "Pago", Icon: Money },
  ];
  const at = paidStep && order.status === "done" ? 3 : ORDER_STATUSES.indexOf(order.status);
  const laborValue = laborDraft ?? "";
  const canSetLabor = can("os.edit") && !locked && totals.laborPending;
  const saveLabor = () => {
    const cents = parseBRL(laborValue);
    if (cents === null) return toast("error", "Escreva o valor da mão de obra. Ex.: 150,00");
    setLabor(order, cents);
    setLaborDraft(null);
  };

  return (
    <>
      <Dialog
        className="order-hero-dialog osd"
        title={
          <span className="osd-title">
            <MiniPlate plate={vehicle?.plate} />
            <span className="osd-title-text">
              <span className="osd-car">{vehicleLabel(vehicle)}</span>
              <span className="osd-owner">{customer?.name ?? "Cliente"}</span>
            </span>
          </span>
        }
        subtitle={
          <span className="osd-sub">
            <span>{number} · aberto {sinceWhen(order.openedAt)}</span>
            {!cancelled && (
              <ol className="osd-steps" aria-label="Caminho do serviço">
                {steps.map((st, i) => {
                  const state = i < at ? "done" : i === at ? "current" : "todo";
                  const target = st.key !== "paid" && st.key !== order.status && canChangeStatus(db, ctx, order.status, st.key) && !order.paymentId;
                  const payable = st.key === "paid" && situation === "pending" && order.status === "done" && can("finance.payment");
                  const content = <><span className="osd-step-dot" aria-hidden>{state === "done" ? <Check size={14} weight="bold" /> : <st.Icon size={16} weight="duotone" />}</span><span className="osd-step-label">{st.label}</span></>;
                  return (
                    <li key={st.key} className="osd-step" data-state={state} aria-current={state === "current" ? "step" : undefined}>
                      {target || payable ? (
                        <button type="button" disabled={!online} title={payable ? "Receber" : `Mudar para ${st.label}`} onClick={() => (payable ? setSub("pay") : moveOrder(order, st.key as OrderStatus))}>{content}</button>
                      ) : <span>{content}</span>}
                    </li>
                  );
                })}
              </ol>
            )}
          </span>
        }
        size="lg"
        onClose={onClose}
        footer={
          <>
            {can("os.edit") && !cancelled && (
              <Button className="mr-auto" icon={<PencilSimple size={18} weight="duotone" aria-hidden />} disabled={!online} onClick={() => setSub("edit")}>
                Editar serviço
              </Button>
            )}
            {can("finance.payment") && situation === "pending" && order.status === "done" ? (
              <Button variant="primary" icon={<CurrencyCircleDollar size={18} weight="duotone" aria-hidden />} disabled={!online} onClick={() => setSub("pay")}>
                Receber {formatBRL(totals.totalCents)}
              </Button>
            ) : !cancelled ? <QuickOrderAction order={order} size="md" statusOnly /> : null}
          </>
        }
      >
        {cancelled && (
          <div className="osd-alert" role="note">
            <strong>Serviço cancelado</strong> em {formatDateTime(order.cancelledAt!)}. Motivo: {order.cancelReason}
          </div>
        )}

        <div className="osd-grid">
          <div className="osd-main">
            <section className="osd-block" aria-labelledby="osd-what">
              <h3 id="osd-what" className="osd-h">O que fazer</h3>
              <p className="osd-desc"><ReadableText label="descrição do serviço" text={order.description} /></p>
              <div className="osd-facts">
                <span className="osd-fact"><span className="svc-avatar" aria-hidden>{mechanicName ? mechanicName.split(" ").map((w) => w[0]).slice(0, 2).join("") : "?"}</span>{mechanicName ? <>Com <strong>{mechanicName.split(" ").slice(0, 2).join(" ")}</strong></> : "Ninguém pegou ainda"}</span>
                {order.mileage ? <span className="osd-fact"><Gauge size={18} weight="duotone" aria-hidden />{order.mileage.toLocaleString("pt-BR")} km</span> : null}
                {can("os.edit") && !cancelled && (
                  <button type="button" className="osd-link" disabled={!online} aria-expanded={pickMech} onClick={() => setPickMech((v) => !v)}>{mechanicName ? "Trocar quem faz" : "Escolher quem faz"}</button>
                )}
              </div>
              {pickMech && (
                <ChoiceGroup
                  className="osd-pick"
                  label="Quem vai fazer?"
                  value={order.mechanicId ?? ""}
                  onChange={(v) => { assign(order, v || null); setPickMech(false); }}
                  options={[{ value: "", label: "Ainda não sei" }, ...mechanics.map((m) => ({ value: m.id, label: m.name.split(" ").slice(0, 2).join(" ") }))]}
                />
              )}
              {order.notes && <p className="osd-notes"><NoteBlank size={18} weight="duotone" aria-hidden />{order.notes}</p>}
            </section>

            <section className="osd-block" aria-labelledby="osd-parts">
              <div className="osd-h-row">
                <h3 id="osd-parts" className="osd-h">Peças <span className="osd-count">{items.length}</span></h3>
                {canEditParts && drafts === null && (
                  <Button size="sm" icon={<Plus size={16} weight="bold" aria-hidden />} disabled={!online} onClick={() => setDrafts(toDrafts(items))}>
                    {order.status === "done" ? "Corrigir peças" : items.length ? "Adicionar ou tirar" : "Adicionar peça"}
                  </Button>
                )}
              </div>
              {drafts !== null ? (
                <div className="osd-edit">
                  <PartsEditor drafts={drafts} onChange={setDrafts} alreadyUsed={new Map(items.map((i) => [i.partId, i.quantity]))} />
                  {order.status === "done" && (
                    <Field label="Por que está corrigindo?" hint="O serviço já está pronto: a correção fica registrada no histórico e no estoque.">
                      {(p) => <Textarea {...p} rows={2} value={correction} onChange={(e) => setCorrection(e.target.value)} />}
                    </Field>
                  )}
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className="mr-auto text-sm text-muted">O estoque muda só pela diferença.</span>
                    <Button onClick={() => { setDrafts(null); setCorrection(""); }}>Descartar</Button>
                    <Button variant="primary" disabled={!online} onClick={saveParts}>Salvar peças</Button>
                  </div>
                </div>
              ) : items.length === 0 ? (
                <p className="osd-empty">Nenhuma peça lançada ainda.</p>
              ) : (
                <ul className="osd-parts">
                  {items.map((i) => (
                    <li key={i.id}>
                      <span className="osd-part-name">{partOf(i.partId)?.name ?? "Peça removida"}</span>
                      <span className="osd-part-qty">{i.quantity} × {formatBRL(i.unitPriceCents)}</span>
                      <span className="osd-part-sum">{formatBRL(i.quantity * i.unitPriceCents)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <OrderPhotos order={order} />

            <details className="more-details osd-history">
              <summary>O que aconteceu ({events.length})</summary>
              <ol className="osd-timeline more-details-body">
                {events.map((e) => (
                  <li key={e.id}>
                    <span className="osd-tl-msg">{e.message}</span>
                    <span className="osd-tl-meta">{formatDateTime(e.at)} · {userOf(e.userId)?.name ?? "Usuário"}</span>
                  </li>
                ))}
              </ol>
            </details>
          </div>

          <aside className="osd-side" aria-label="Valor e ações">
            <section className="osd-money" aria-labelledby="osd-total">
              <h3 id="osd-total" className="osd-h">Quanto custa</h3>
              <p className="osd-total"><ReadableText label="total do serviço" text={totals.laborPending ? orderTotalText(totals) : formatBRL(totals.totalCents)} /></p>
              <dl className="osd-break">
                <div><dt>Mão de obra</dt><dd>{formatBRLOrPending(totals.laborCents)}</dd></div>
                <div><dt>Peças</dt><dd>{formatBRL(totals.partsCents)}</dd></div>
              </dl>
              {canSetLabor && (laborDraft === null ? (
                <Button className="w-full" icon={<PencilSimple size={16} weight="duotone" aria-hidden />} disabled={!online} onClick={() => setLaborDraft("")}>Definir mão de obra</Button>
              ) : (
                <form className="osd-labor" onSubmit={(e) => { e.preventDefault(); saveLabor(); }}>
                  <Field label="Mão de obra (R$)">{(p) => <Input {...p} inputMode="decimal" autoFocus value={laborValue} onChange={(e) => setLaborDraft(maskMoney(e.target.value))} />}</Field>
                  <div className="flex gap-2"><Button onClick={() => setLaborDraft(null)}>Cancelar</Button><Button type="submit" variant="primary" disabled={!online}>Salvar</Button></div>
                </form>
              ))}
              <p className="osd-paynote" data-state={situation}>
                {situation === "paid" && payment
                  ? <><SealCheck size={18} weight="duotone" aria-hidden />Pago {sinceWhen(payment.paidAt)} no {PAYMENT_METHOD_LABELS[payment.method].toLowerCase()}.</>
                  : situation === "pending"
                    ? order.status === "done" ? "Pronto, falta receber." : "Ainda não foi pago."
                    : situation === "undefined"
                      ? "Falta definir a mão de obra para poder receber."
                      : situation === "free" ? "Serviço sem cobrança." : ""}
              </p>
              {can("finance.view") && !totals.laborPending && totals.totalCents > 0 && (
                <p className="osd-margin">Sobra estimada: <strong>{formatBRL(totals.totalCents - totals.partsCostCents)}</strong> <span>(tirando só o custo das peças)</span></p>
              )}
            </section>

            {!cancelled && customer && (
              <section className="osd-actions" aria-label="Falar com o cliente">
                <a className="osd-action" href={`tel:${customer.phone}`}><Phone size={20} weight="duotone" aria-hidden /><span>Ligar<small>{formatPhone(customer.phone)}</small></span></a>
                <button type="button" className="osd-action" onClick={() => setSub("update")}><WhatsappLogo size={20} weight="duotone" aria-hidden /><span>Avisar no WhatsApp<small>Como está o carro</small></span></button>
                <button type="button" className="osd-action" onClick={() => setSub("quote")}><Receipt size={20} weight="duotone" aria-hidden /><span>Mandar orçamento<small>Pelo WhatsApp</small></span></button>
              </section>
            )}
            <section className="osd-actions is-quiet" aria-label="Outras ações">
              <button type="button" className="osd-action" disabled={exporting} onClick={downloadPdf}><FilePdf size={20} weight="duotone" aria-hidden /><span>{exporting ? "Gerando PDF…" : "Gerar PDF"}</span></button>
              {can("os.cancel") && !locked && order.status !== "done" && (
                <button type="button" className="osd-action is-danger" disabled={!online} onClick={() => setSub("cancel")}><Prohibit size={20} weight="duotone" aria-hidden /><span>Cancelar serviço</span></button>
              )}
            </section>
          </aside>
        </div>
      </Dialog>

      {sub === "edit" && <EditOrderDialog order={order} onClose={() => setSub(null)} />}
      {sub === "pay" && <PaymentDialog orderId={order.id} onClose={() => setSub(null)} />}
      {sub === "cancel" && <CancelOrderDialog order={order} hasParts={items.length > 0} onClose={() => setSub(null)} />}
      {sub === "quote" && customer && (
        <WhatsAppDialog
          title={`Orçamento do ${number}`}
          phone={customer.phone}
          text={quoteMessage({ ...whatsappBase, description: order.description, laborCents: totals.laborCents, partsCents: totals.partsCents, totalCents: totals.totalCents })}
          onClose={() => setSub(null)}
        />
      )}
      {sub === "update" && customer && (
        <WhatsAppDialog
          title={`Atualização do ${number}`}
          phone={customer.phone}
          text={statusMessage({ ...whatsappBase, orderNumber: order.number, statusLabel: ORDER_STATUS_LABELS[order.status] })}
          onClose={() => setSub(null)}
        />
      )}
    </>
  );
}
