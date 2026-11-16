import type {
  AppointmentStatus,
  OrderStatus,
  PaymentMethod,
  StockMovementType,
} from "./types";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  waiting: "Aguardando",
  in_progress: "Em andamento",
  done: "Concluído",
};

export const ORDER_STATUSES: OrderStatus[] = ["waiting", "in_progress", "done"];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  card: "Cartão",
  transfer: "Transferência",
};

export const PAYMENT_METHODS: PaymentMethod[] = ["cash", "pix", "card", "transfer"];

export const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  in: "Entrada",
  out: "Saída manual",
  adjust: "Ajuste",
  order_out: "Saída por OS",
  return: "Estorno / devolução",
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  attended: "Atendido",
  cancelled: "Cancelado",
};

export const EXPENSE_CATEGORIES = [
  "Compra de peças",
  "Aluguel",
  "Energia",
  "Água",
  "Funcionários",
  "Ferramentas",
  "Outras despesas",
];

export const PART_CATEGORIES = [
  "Filtros",
  "Lubrificantes",
  "Freios",
  "Elétrica",
  "Suspensão",
  "Motor",
  "Outros",
];
