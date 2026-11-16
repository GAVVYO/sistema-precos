import { formatBRL, formatOrderNumber, formatPlate, normalizePhone } from "./format";

/**
 * Link oficial "click to chat" do WhatsApp. Apenas abre a conversa com o texto
 * preenchido — não há envio automático nem confirmação de entrega.
 */
export function buildWhatsAppUrl(phone: string, text: string): string | null {
  const digits = normalizePhone(phone);
  if (!digits) return null;
  return `https://wa.me/55${digits}?text=${encodeURIComponent(text)}`;
}

export interface QuoteData {
  customerName: string;
  workshopName: string;
  vehicle: string;
  plate: string;
  description: string;
  laborCents: number | null;
  partsCents: number;
  totalCents: number;
}

export function quoteMessage(q: QuoteData): string {
  const first = q.customerName.split(" ")[0];
  const labor = q.laborCents === null ? "a definir" : formatBRL(q.laborCents);
  const total =
    q.laborCents !== null
      ? formatBRL(q.totalCents)
      : q.partsCents > 0
        ? `${formatBRL(q.totalCents)} + mão de obra a definir`
        : "a definir";
  return [
    `Olá, ${first}! Aqui é da ${q.workshopName}.`,
    "",
    `Segue o orçamento do seu ${q.vehicle} (placa ${formatPlate(q.plate)}):`,
    "",
    `Serviço: ${q.description}`,
    `Mão de obra: ${labor}`,
    `Peças: ${formatBRL(q.partsCents)}`,
    `Total: ${total}`,
    "",
    "Podemos seguir com o serviço?",
  ].join("\n");
}

export function statusMessage(s: {
  customerName: string;
  workshopName: string;
  vehicle: string;
  plate: string;
  orderNumber: number;
  statusLabel: string;
}): string {
  const first = s.customerName.split(" ")[0];
  return [
    `Olá, ${first}! Aqui é da ${s.workshopName}.`,
    "",
    `Atualização da ${formatOrderNumber(s.orderNumber)} — ${s.vehicle} (placa ${formatPlate(s.plate)}):`,
    `Status atual: ${s.statusLabel}.`,
  ].join("\n");
}
