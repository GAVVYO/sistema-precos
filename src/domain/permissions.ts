import type { ModuleKey, PermissionKey, Role } from "./types";

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Proprietário",
  receptionist: "Recepcionista",
  mechanic: "Mecânico",
  financial: "Financeiro",
};

export interface PermissionInfo {
  key: PermissionKey;
  label: string;
  group: string;
}

export const PERMISSIONS: PermissionInfo[] = [
  { key: "os.view", label: "Ver serviços", group: "Serviços" },
  { key: "os.create", label: "Abrir serviços", group: "Serviços" },
  { key: "os.edit", label: "Editar dados do serviço", group: "Serviços" },
  { key: "os.status", label: "Mudar a etapa do serviço", group: "Serviços" },
  { key: "os.parts", label: "Lançar e retirar peças do serviço", group: "Serviços" },
  { key: "os.complete", label: "Marcar serviço como pronto", group: "Serviços" },
  { key: "os.cancel", label: "Cancelar serviço", group: "Serviços" },
  { key: "stock.view", label: "Consultar estoque", group: "Estoque" },
  { key: "stock.move", label: "Cadastrar peças e movimentar estoque", group: "Estoque" },
  { key: "finance.view", label: "Consultar financeiro", group: "Financeiro" },
  { key: "finance.payment", label: "Registrar pagamentos e receitas", group: "Financeiro" },
  { key: "finance.expense", label: "Registrar despesas", group: "Financeiro" },
  { key: "schedule.manage", label: "Gerenciar agenda", group: "Agenda e clientes" },
  { key: "customers.view", label: "Consultar clientes e veículos", group: "Agenda e clientes" },
  { key: "reports.view", label: "Consultar relatórios", group: "Relatórios" },
  { key: "reports.export", label: "Exportar relatórios", group: "Relatórios" },
  { key: "staff.manage", label: "Gerenciar funcionários", group: "Administração" },
  { key: "settings.manage", label: "Alterar configurações", group: "Administração" },
];

export const ALL_PERMISSIONS: PermissionKey[] = PERMISSIONS.map((p) => p.key);

/** Modelos iniciais por cargo; o proprietário pode personalizar por funcionário. */
export const ROLE_TEMPLATES: Record<Role, PermissionKey[]> = {
  owner: ALL_PERMISSIONS,
  receptionist: [
    "os.view",
    "os.create",
    "os.edit",
    "os.status",
    "schedule.manage",
    "customers.view",
    "stock.view",
    // Recepção recebe no balcão (decisão do dono, 17/11/2026); não vê o Financeiro.
    "finance.payment",
  ],
  mechanic: ["os.view", "os.status", "os.parts", "os.complete", "stock.view", "customers.view"],
  financial: [
    "os.view",
    "finance.view",
    "finance.payment",
    "finance.expense",
    "customers.view",
    "reports.view",
    "reports.export",
  ],
};

export interface ModuleInfo {
  key: ModuleKey;
  label: string;
  href: string;
  /** Basta uma destas permissões para o módulo aparecer. Vazio = sempre visível. */
  anyOf: PermissionKey[];
  /** Módulos essenciais não podem ser desativados pela oficina. */
  required?: boolean;
}

export const MODULES: ModuleInfo[] = [
  { key: "dashboard", label: "Hoje", href: "/inicio", anyOf: [], required: true },
  { key: "orders", label: "Serviços", href: "/ordens", anyOf: ["os.view"] },
  { key: "stock", label: "Estoque", href: "/estoque", anyOf: ["stock.view"] },
  { key: "finance", label: "Financeiro", href: "/financeiro", anyOf: ["finance.view"] },
  { key: "schedule", label: "Agenda", href: "/agenda", anyOf: ["schedule.manage"] },
  { key: "customers", label: "Clientes e veículos", href: "/clientes", anyOf: ["customers.view"] },
  { key: "reports", label: "Relatórios", href: "/relatorios", anyOf: ["reports.view"] },
  {
    key: "settings",
    label: "Configurações",
    href: "/configuracoes",
    anyOf: ["settings.manage", "staff.manage"],
    required: true,
  },
];

export const ALL_MODULES: ModuleKey[] = MODULES.map((m) => m.key);
