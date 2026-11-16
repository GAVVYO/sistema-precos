"use client";

import { Command } from "cmdk";
import {
  ArrowRight, CalendarPlus, ClipboardList, Keyboard, Package, Plus, Search, User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useRef, useState } from "react";
import { useApp } from "@/app-state/app-context";
import { runUndo } from "@/components/ui/toast";
import { formatOrderNumber, formatPlate } from "@/lib/format";
import { modKey } from "@/lib/prefs";
import { useVisibleModules } from "./app-shell";

/* ---------- Abertura global ---------- */

const OPEN_EVENT = "gavyo:command-palette";

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/** Lê a busca inicial passada pela paleta na URL (?q=). Sem efeitos colaterais (seguro no StrictMode). */
export function takeQueryParam(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("q") ?? "";
}

/* ---------- Atalhos ---------- */

/** Letra usada depois de "G" para ir a cada módulo (estilo Gmail/Linear). */
export const GO_KEYS: Record<string, string> = {
  "/inicio": "I",
  "/ordens": "O",
  "/estoque": "E",
  "/financeiro": "F",
  "/agenda": "A",
  "/clientes": "C",
  "/relatorios": "R",
  "/configuracoes": "S",
};

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/** Algum modal nativo aberto? Atalhos de uma letra não devem agir por trás dele. */
function modalOpen(): boolean {
  return document.querySelector("dialog[open]") !== null;
}

/**
 * Atalhos globais. ⌘K/Ctrl+K sempre abre a paleta; os de uma letra só valem
 * fora de campos de texto e de modais, como no Finder/Mail.
 */
export function useGlobalShortcuts(onPalette: () => void) {
  const router = useRouter();
  const { can, online, settings, openNewOrder } = useApp();
  const modules = useVisibleModules();

  useEffect(() => {
    let goPending = 0;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onPalette();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z" && !isTyping(e.target) && !modalOpen()) {
        if (runUndo()) e.preventDefault();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || modalOpen()) return;
      const key = e.key.toUpperCase();

      if (Date.now() - goPending < 1200) {
        goPending = 0;
        const target = modules.find((m) => GO_KEYS[m.href] === key);
        if (target) {
          e.preventDefault();
          router.push(target.href);
        }
        return;
      }
      if (key === "G") {
        goPending = Date.now();
        return;
      }
      if (key === "N" && online && can("os.create") && settings.activeModules.includes("orders")) {
        e.preventDefault();
        openNewOrder();
        return;
      }
      if (e.key === "/" || e.key === "?") {
        e.preventDefault();
        onPalette();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modules, router, can, online, settings.activeModules, openNewOrder, onPalette]);
}

/* ---------- Paleta ---------- */

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-slate-50 px-1 font-sans text-[11px] font-medium text-muted">
      {children}
    </kbd>
  );
}

function Item({
  value,
  keywords,
  icon,
  children,
  hint,
  onSelect,
  disabled,
}: {
  value: string;
  keywords?: string[];
  icon: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <Command.Item
      value={value}
      keywords={keywords}
      disabled={disabled}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-ink data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50 data-[selected=true]:bg-primary-soft data-[selected=true]:text-primary"
    >
      <span className="flex size-6 shrink-0 items-center justify-center text-muted" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="flex shrink-0 items-center gap-1 text-xs text-muted">{hint}</span>}
    </Command.Item>
  );
}

const GROUP =
  "px-1.5 pb-1 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:pb-1 " +
  "[&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted";

export function CommandPalette() {
  const { view, can, online, settings, customerOf, vehicleOf, openOrder, openNewOrder } = useApp();
  const router = useRouter();
  const modules = useVisibleModules();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const mod = modKey();

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  useGlobalShortcuts(() => setOpen((o) => !o));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      el.querySelector<HTMLInputElement>("[cmdk-input]")?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const run = (fn: () => void) => {
    close();
    fn();
  };

  const active = (m: string) => settings.activeModules.includes(m as never);
  const showOrders = can("os.view") && active("orders");
  const showCustomers = can("customers.view") && active("customers");
  const showStock = can("stock.view") && active("stock");
  const searching = query.trim().length >= 2;

  return (
    <dialog
      ref={ref}
      aria-label="Paleta de comandos"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => e.target === ref.current && close()}
      className="mx-auto mt-[12vh] mb-auto w-[calc(100vw-2rem)] max-w-xl overflow-hidden rounded-lg border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-slate-900/30"
    >
      {open && (
        <Command label="Paleta de comandos" loop>
          <div className="flex items-center gap-2 border-b border-line px-3.5">
            <Search className="size-4 shrink-0 text-muted" aria-hidden />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Buscar OS, cliente, placa, peça ou comando…"
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 focus-visible:outline-none"
            />
            <Kbd>Esc</Kbd>
          </div>
          <Command.List className="max-h-[min(420px,60vh)] overflow-y-auto overscroll-contain py-1">
            <Command.Empty className="px-4 py-8 text-center text-[13px] text-muted">
              Nada encontrado para “{query}”.
            </Command.Empty>

            <Command.Group heading="Ações" className={GROUP}>
              {can("os.create") && active("orders") && (
                <Item value="Nova ordem de serviço" keywords={["os", "abrir", "criar"]} icon={<Plus className="size-4" />} hint={<Kbd>N</Kbd>} disabled={!online} onSelect={() => run(() => openNewOrder())}>
                  Nova ordem de serviço
                </Item>
              )}
              {can("schedule.manage") && active("schedule") && (
                <Item value="Novo agendamento" keywords={["agenda", "marcar", "horário"]} icon={<CalendarPlus className="size-4" />} disabled={!online} onSelect={() => run(() => router.push("/agenda?novo=1"))}>
                  Novo agendamento
                </Item>
              )}
            </Command.Group>

            <Command.Group heading="Ir para" className={GROUP}>
              {modules.map((m) => (
                <Item
                  key={m.key}
                  value={`Ir para ${m.label}`}
                  icon={<ArrowRight className="size-4" />}
                  hint={GO_KEYS[m.href] && <><Kbd>G</Kbd><Kbd>{GO_KEYS[m.href]}</Kbd></>}
                  onSelect={() => run(() => router.push(m.href))}
                >
                  {m.label}
                </Item>
              ))}
            </Command.Group>

            {searching && showOrders && (
              <Command.Group heading="Ordens de serviço" className={GROUP}>
                {view.orders.slice(0, 400).map((o) => {
                  const v = vehicleOf(o.vehicleId);
                  const c = customerOf(o.customerId);
                  const number = formatOrderNumber(o.number);
                  return (
                    <Item
                      key={o.id}
                      value={`os ${o.id}`}
                      keywords={[number, String(o.number), c?.name ?? "", v?.plate ?? "", v ? formatPlate(v.plate) : "", v ? `${v.brand} ${v.model}` : "", o.description]}
                      icon={<ClipboardList className="size-4" />}
                      hint={o.cancelledAt ? "Cancelada" : undefined}
                      onSelect={() => run(() => openOrder(o.id))}
                    >
                      <span className="font-semibold">{number}</span> · {c?.name}
                      <span className="text-muted"> · {v ? `${v.brand} ${v.model} ${formatPlate(v.plate)}` : ""}</span>
                    </Item>
                  );
                })}
              </Command.Group>
            )}

            {searching && showCustomers && (
              <Command.Group heading="Clientes" className={GROUP}>
                {view.customers.map((c) => (
                  <Item
                    key={c.id}
                    value={`cliente ${c.id}`}
                    keywords={[c.name, c.phone, ...view.vehicles.filter((v) => v.customerId === c.id).map((v) => v.plate)]}
                    icon={<User className="size-4" />}
                    onSelect={() => run(() => router.push(`/clientes?q=${encodeURIComponent(c.name)}`))}
                  >
                    {c.name}
                  </Item>
                ))}
              </Command.Group>
            )}

            {searching && showStock && (
              <Command.Group heading="Peças" className={GROUP}>
                {view.parts.map((p) => (
                  <Item
                    key={p.id}
                    value={`peça ${p.id}`}
                    keywords={[p.name, p.code, p.category]}
                    icon={<Package className="size-4" />}
                    hint={<span className="tabular-nums">{p.quantity} un.</span>}
                    onSelect={() => run(() => router.push(`/estoque?q=${encodeURIComponent(p.code)}`))}
                  >
                    {p.name} <span className="text-muted">· {p.code}</span>
                  </Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
          <footer className="flex items-center gap-4 border-t border-line bg-slate-50 px-3.5 py-2 text-[11px] text-muted">
            <span className="flex items-center gap-1"><Keyboard className="size-3.5" aria-hidden /> Atalhos:</span>
            <span className="flex items-center gap-1"><Kbd>{mod}</Kbd><Kbd>K</Kbd> abrir</span>
            <span className="flex items-center gap-1"><Kbd>N</Kbd> nova OS</span>
            <span className="flex items-center gap-1"><Kbd>G</Kbd> + letra ir para</span>
            <span className="flex items-center gap-1"><Kbd>{mod}</Kbd><Kbd>Z</Kbd> desfazer</span>
            <span className="ml-auto flex items-center gap-1"><Kbd>↵</Kbd> escolher</span>
          </footer>
        </Command>
      )}
    </dialog>
  );
}

/** Botão de busca do cabeçalho, no estilo do Spotlight. */
export function CommandButton() {
  // A área logada só renderiza no cliente, então o navegador já é conhecido.
  const mod = modKey();
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      aria-label="Buscar e executar comandos"
      aria-keyshortcuts="Control+K Meta+K"
      className="flex h-8 items-center gap-2 rounded-md bg-white/10 px-2.5 text-xs opacity-90 hover:bg-white/15 hover:opacity-100"
    >
      <Search className="size-3.5" aria-hidden />
      <span className="hidden 2xl:inline">Buscar</span>
      <kbd className="rounded bg-white/15 px-1 font-sans text-[11px]">{mod} K</kbd>
    </button>
  );
}
