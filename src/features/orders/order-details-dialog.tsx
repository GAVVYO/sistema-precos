"use client";

import { Ban, CircleDollarSign, FileDown, MessageCircle, Pencil, RefreshCw } from "lucide-react";
import { ReactNode, useState } from "react";
import { useApp } from "@/app-state/app-context";
import { Dialog } from "@/components/ui/dialog";
import { Button, Field, Select, Textarea } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { ORDER_STATUS_LABELS, ORDER_STATUSES, PAYMENT_METHOD_LABELS } from "@/domain/labels";
import type { ID, OrderStatus } from "@/domain/types";
import { exportOrderPdf } from "@/lib/export";
import { formatBRL, formatBRLOrPending, formatDateTime, formatOrderNumber, formatPhone, formatPlate } from "@/lib/format";
import { quoteMessage, statusMessage } from "@/lib/whatsapp";
import {
  canChangeStatus, changeOrderStatus, orderTotals, PAYMENT_SITUATION_LABELS, paymentSituation, setOrderItems,
} from "@/services/orders";
import { CancelOrderDialog, EditOrderDialog, PaymentDialog, WhatsAppDialog } from "./order-dialogs";
import { DraftItem, draftsToItems, orderTotalText, PartsEditor, PaymentBadge, StatusBadge, toDrafts, vehicleLabel } from "./shared";

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-[13px] font-medium">{children}</dd>
    </div>
  );
}

type Sub = null | "edit" | "pay" | "cancel" | "quote" | "update";

export function OrderDetailsDialog({ orderId, onClose }: { orderId: ID; onClose: () => void }) {
  const { db, view, act, can, online, user, settings, customerOf, vehicleOf, userOf, partOf } = useApp();
  const [sub, setSub] = useState<Sub>(null);
  const [drafts, setDrafts] = useState<DraftItem[] | null>(null);
  const [correction, setCorrection] = useState("");
  const [exporting, setExporting] = useState(false);

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
          kind: order.status === "done" || order.paymentId ? "Ordem de serviço" : "Orçamento",
          status: cancelled ? "Cancelada" : ORDER_STATUS_LABELS[order.status],
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

  return (
    <>
      <Dialog
        title={`${number} — ${order.description}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge order={order} />
            <PaymentBadge order={order} />
            <span>Aberta em {formatDateTime(order.openedAt)}</span>
          </span>
        }
        size="lg"
        onClose={onClose}
        footer={
          <>
            {!cancelled && (
              <label className="mr-auto flex items-center gap-2 text-xs text-muted">
                Status
                <Select
                  className="h-8 w-40"
                  value={order.status}
                  disabled={!online || !ORDER_STATUSES.some((s) => s !== order.status && canChangeStatus(db, ctx, order.status, s))}
                  onChange={(e) => {
                    const next = e.target.value as OrderStatus;
                    act((d, c) => changeOrderStatus(d, c, order.id, next), `${number} movida para ${ORDER_STATUS_LABELS[next]}.`);
                  }}
                >
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s} disabled={s !== order.status && !canChangeStatus(db, ctx, order.status, s)}>
                      {ORDER_STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            {can("os.edit") && !cancelled && (
              <Button icon={<Pencil className="size-4" aria-hidden />} disabled={!online} onClick={() => setSub("edit")}>
                Editar
              </Button>
            )}
            {can("finance.payment") && situation === "pending" && (
              <Button variant="primary" icon={<CircleDollarSign className="size-4" aria-hidden />} disabled={!online} onClick={() => setSub("pay")}>
                Registrar pagamento
              </Button>
            )}
          </>
        }
      >
        {cancelled && (
          <div className="mb-4 rounded-md border border-red-200 bg-danger-soft px-3 py-2 text-[13px] text-danger">
            <strong>OS cancelada</strong> em {formatDateTime(order.cancelledAt!)}. Motivo: {order.cancelReason}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
          <div className="space-y-5">
            <dl className="grid grid-cols-3 gap-x-4 gap-y-3 rounded-md border border-line p-3">
              <Info label="Cliente">{customer?.name ?? "—"}</Info>
              <Info label="Telefone">{customer ? formatPhone(customer.phone) : "—"}</Info>
              <Info label="Responsável">{userOf(order.mechanicId)?.name ?? "A definir"}</Info>
              <Info label="Veículo">{vehicleLabel(vehicle)}</Info>
              <Info label="Placa">{vehicle ? formatPlate(vehicle.plate) : "—"}</Info>
              <Info label="Quilometragem">{order.mileage ? `${order.mileage.toLocaleString("pt-BR")} km` : "—"}</Info>
              {order.notes && (
                <div className="col-span-3">
                  <dt className="text-xs text-muted">Observações</dt>
                  <dd className="text-[13px]">{order.notes}</dd>
                </div>
              )}
            </dl>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Peças utilizadas</h3>
                {canEditParts && drafts === null && (
                  <Button size="sm" disabled={!online} onClick={() => setDrafts(toDrafts(items))}>
                    {order.status === "done" ? "Corrigir peças" : "Adicionar ou remover peças"}
                  </Button>
                )}
              </div>
              {drafts !== null ? (
                <div className="space-y-3 rounded-md border border-primary/40 bg-primary-soft/40 p-3">
                  <PartsEditor drafts={drafts} onChange={setDrafts} alreadyUsed={new Map(items.map((i) => [i.partId, i.quantity]))} />
                  {order.status === "done" && (
                    <Field label="Motivo da correção" hint="Obrigatório: esta OS já foi concluída e a correção ficará registrada no histórico e no estoque.">
                      {(p) => <Textarea {...p} rows={2} value={correction} onChange={(e) => setCorrection(e.target.value)} />}
                    </Field>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <span className="mr-auto text-xs text-muted">O estoque é movimentado apenas pela diferença.</span>
                    <Button size="sm" onClick={() => { setDrafts(null); setCorrection(""); }}>Descartar</Button>
                    <Button size="sm" variant="primary" disabled={!online} onClick={saveParts}>Salvar peças</Button>
                  </div>
                </div>
              ) : items.length === 0 ? (
                <p className="rounded-md border border-dashed border-line px-3 py-4 text-center text-[13px] text-muted">Nenhuma peça adicionada a esta OS.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-line">
                  <table className="data-table">
                    <thead>
                      <tr><th>Peça</th><th className="num">Qtd.</th><th className="num">Preço unit.</th><th className="num">Subtotal</th></tr>
                    </thead>
                    <tbody>
                      {items.map((i) => (
                        <tr key={i.id}>
                          <td>{partOf(i.partId)?.name ?? "Peça removida"} <span className="text-xs text-muted">{partOf(i.partId)?.code}</span></td>
                          <td className="num">{i.quantity}</td>
                          <td className="num">{formatBRL(i.unitPriceCents)}</td>
                          <td className="num">{formatBRL(i.quantity * i.unitPriceCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">Histórico de alterações</h3>
              <ol className="space-y-1.5 border-l-2 border-line pl-3">
                {events.map((e) => (
                  <li key={e.id} className="text-[13px]">
                    <span className="text-xs text-muted">{formatDateTime(e.at)} · {userOf(e.userId)?.name ?? "Usuário"}</span>
                    <br />
                    {e.message}
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <aside className="space-y-3">
            <div className="rounded-md border border-line p-3">
              <h3 className="mb-2 text-sm font-semibold">Valores</h3>
              <dl className="space-y-1 text-[13px]">
                <div className="flex justify-between"><dt className="text-muted">Mão de obra</dt><dd>{formatBRLOrPending(totals.laborCents)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Peças</dt><dd>{formatBRL(totals.partsCents)}</dd></div>
                <div className="flex justify-between border-t border-line pt-1.5 text-base font-semibold"><dt>Total</dt><dd>{orderTotalText(totals)}</dd></div>
              </dl>
              <p className="mt-2 text-xs text-muted">
                {situation === "paid" && payment
                  ? `Pago em ${formatDateTime(payment.paidAt)} via ${PAYMENT_METHOD_LABELS[payment.method]}.`
                  : situation === "pending"
                    ? order.status === "done" ? "Serviço concluído, aguardando pagamento." : "Pagamento ainda não registrado."
                    : situation === "undefined"
                      ? "Informe a mão de obra para liberar o pagamento."
                      : situation === "free" ? "Serviço sem cobrança." : ""}
              </p>
              {can("finance.view") && !totals.laborPending && totals.totalCents > 0 && (
                <p className="mt-2 border-t border-line pt-2 text-xs text-muted">
                  Margem estimada: <strong className="text-ink">{formatBRL(totals.totalCents - totals.partsCostCents)}</strong>
                  <br />
                  Considera apenas o custo das peças ({formatBRL(totals.partsCostCents)}); não inclui mão de obra interna nem despesas fixas.
                </p>
              )}
            </div>

            <div className="rounded-md border border-line p-3">
              <h3 className="mb-2 text-sm font-semibold">Documentos e gestão</h3>
              <div className="flex flex-col items-stretch gap-2">
                <Button icon={<FileDown className="size-4" aria-hidden />} loading={exporting} onClick={downloadPdf}>Gerar PDF</Button>
                {can("os.cancel") && !locked && order.status !== "done" && (
                  <Button variant="danger" icon={<Ban className="size-4" aria-hidden />} disabled={!online} onClick={() => setSub("cancel")}>Cancelar OS</Button>
                )}
              </div>
            </div>

            {!cancelled && customer && (
              <div className="rounded-md border border-line p-3">
                <h3 className="mb-2 text-sm font-semibold">WhatsApp</h3>
                <div className="flex flex-col gap-2">
                  <Button icon={<MessageCircle className="size-4" aria-hidden />} onClick={() => setSub("quote")}>Enviar orçamento</Button>
                  <Button icon={<RefreshCw className="size-4" aria-hidden />} onClick={() => setSub("update")}>Enviar atualização</Button>
                </div>
              </div>
            )}
          </aside>
        </div>
      </Dialog>

      {sub === "edit" && <EditOrderDialog order={order} onClose={() => setSub(null)} />}
      {sub === "pay" && <PaymentDialog orderId={order.id} onClose={() => setSub(null)} />}
      {sub === "cancel" && <CancelOrderDialog order={order} hasParts={items.length > 0} onClose={() => setSub(null)} />}
      {sub === "quote" && customer && (
        <WhatsAppDialog
          title={`Orçamento da ${number}`}
          phone={customer.phone}
          text={quoteMessage({ ...whatsappBase, description: order.description, laborCents: totals.laborCents, partsCents: totals.partsCents, totalCents: totals.totalCents })}
          onClose={() => setSub(null)}
        />
      )}
      {sub === "update" && customer && (
        <WhatsAppDialog
          title={`Atualização da ${number}`}
          phone={customer.phone}
          text={statusMessage({ ...whatsappBase, orderNumber: order.number, statusLabel: ORDER_STATUS_LABELS[order.status] })}
          onClose={() => setSub(null)}
        />
      )}
    </>
  );
}
