/**
 * Modelos de domínio do GAVYO Auto.
 *
 * Espelham o schema MySQL previsto em prisma/schema.prisma:
 * - toda entidade de negócio carrega `workshopId` (isolamento multiempresa);
 * - valores monetários são inteiros em centavos (nunca ponto flutuante);
 * - datas/horários são strings ISO 8601 (UTC); datas "de calendário" usam AAAA-MM-DD.
 */

export type ID = string;
/** Valor monetário em centavos de real. */
export type Cents = number;
/** Instante em ISO 8601 (UTC). */
export type ISODateTime = string;
/** Data de calendário AAAA-MM-DD (fuso America/Fortaleza). */
export type ISODate = string;

export type Role = "owner" | "receptionist" | "mechanic" | "financial";

export type ModuleKey =
  | "dashboard"
  | "orders"
  | "stock"
  | "finance"
  | "schedule"
  | "customers"
  | "reports"
  | "settings";

export type PermissionKey =
  | "os.view"
  | "os.create"
  | "os.edit"
  | "os.status"
  | "os.parts"
  | "os.complete"
  | "os.cancel"
  | "stock.view"
  | "stock.move"
  | "finance.view"
  | "finance.payment"
  | "finance.expense"
  | "schedule.manage"
  | "customers.view"
  | "reports.view"
  | "reports.export"
  | "staff.manage"
  | "settings.manage";

export interface Workshop {
  id: ID;
  name: string;
  slug: string;
  createdAt: ISODateTime;
}

export interface WorkshopSettings {
  workshopId: ID;
  displayName: string;
  phone: string;
  /** Logotipo como data URL (apenas na demonstração; em produção será um arquivo). */
  logoDataUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  activeModules: ModuleKey[];
}

export interface User {
  id: ID;
  name: string;
  email: string;
  /** Telefone (só dígitos), opcional. */
  phone?: string;
  /** Foto do crachá (data URL JPEG pequeno, ~256 px), opcional. */
  photo?: string | null;
}

export interface WorkshopMembership {
  id: ID;
  workshopId: ID;
  userId: ID;
  role: Role;
  active: boolean;
  /** Permissões efetivas; o cargo serve apenas de modelo inicial. */
  permissions: PermissionKey[];
}

export interface Customer {
  id: ID;
  workshopId: ID;
  name: string;
  phone: string;
  createdAt: ISODateTime;
}

export interface Vehicle {
  id: ID;
  workshopId: ID;
  customerId: ID;
  plate: string;
  brand: string;
  model: string;
  year: number | null;
  mileage: number | null;
}

export type OrderStatus = "waiting" | "in_progress" | "done";

export interface ServiceOrder {
  id: ID;
  workshopId: ID;
  /** Numeração sequencial única dentro da oficina. */
  number: number;
  customerId: ID;
  vehicleId: ID;
  description: string;
  notes: string;
  mechanicId: ID | null;
  /** `null` = valor ainda não informado; `0` = mão de obra gratuita. */
  laborCents: Cents | null;
  mileage: number | null;
  status: OrderStatus;
  openedAt: ISODateTime;
  completedAt: ISODateTime | null;
  /** Cancelamento é um atributo, não uma coluna do Kanban. */
  cancelledAt: ISODateTime | null;
  cancelReason: string | null;
  paymentId: ID | null;
  appointmentId: ID | null;
}

export interface ServiceOrderItem {
  id: ID;
  workshopId: ID;
  orderId: ID;
  partId: ID;
  quantity: number;
  unitPriceCents: Cents;
  /** Custo no momento do uso, para margem estimada. */
  unitCostCents: Cents;
}

export interface ServiceOrderEvent {
  id: ID;
  workshopId: ID;
  orderId: ID;
  at: ISODateTime;
  userId: ID;
  message: string;
}

export interface Part {
  id: ID;
  workshopId: ID;
  /** Código interno, único dentro da oficina. */
  code: string;
  name: string;
  category: string;
  description: string;
  quantity: number;
  minQuantity: number;
  costCents: Cents;
  priceCents: Cents;
}

export type StockMovementType = "in" | "out" | "adjust" | "order_out" | "return";

export interface StockMovement {
  id: ID;
  workshopId: ID;
  partId: ID;
  type: StockMovementType;
  /** Variação com sinal: positivo entra, negativo sai. */
  delta: number;
  balanceAfter: number;
  reason: string;
  userId: ID;
  orderId: ID | null;
  at: ISODateTime;
}

export type AppointmentStatus = "scheduled" | "confirmed" | "attended" | "cancelled";

export interface Appointment {
  id: ID;
  workshopId: ID;
  customerName: string;
  phone: string;
  plate: string;
  brand: string;
  model: string;
  service: string;
  date: ISODate;
  /** HH:mm */
  time: string;
  mechanicId: ID | null;
  notes: string;
  status: AppointmentStatus;
  /** Preenchido ao converter em OS; impede conversão duplicada. */
  orderId: ID | null;
}

export type PaymentMethod = "cash" | "pix" | "card" | "transfer";
export type TransactionKind = "income" | "expense";
export type TransactionStatus = "paid" | "pending";

export interface Payment {
  id: ID;
  workshopId: ID;
  orderId: ID;
  amountCents: Cents;
  method: PaymentMethod;
  paidAt: ISODateTime;
  userId: ID;
}

export interface FinancialTransaction {
  id: ID;
  workshopId: ID;
  kind: TransactionKind;
  description: string;
  category: string;
  amountCents: Cents;
  date: ISODate;
  method: PaymentMethod;
  status: TransactionStatus;
  customerId: ID | null;
  orderId: ID | null;
  /** Receita originada de pagamento de OS (único por pagamento). */
  paymentId: ID | null;
  notes: string;
  userId: ID;
}

/** Conjunto completo de tabelas — equivalente ao banco MySQL futuro. */
export interface Database {
  version: number;
  workshops: Workshop[];
  settings: WorkshopSettings[];
  users: User[];
  memberships: WorkshopMembership[];
  customers: Customer[];
  vehicles: Vehicle[];
  orders: ServiceOrder[];
  orderItems: ServiceOrderItem[];
  orderEvents: ServiceOrderEvent[];
  parts: Part[];
  stockMovements: StockMovement[];
  appointments: Appointment[];
  transactions: FinancialTransaction[];
  payments: Payment[];
  /** Próximo número de OS por oficina. */
  orderCounters: Record<ID, number>;
}
