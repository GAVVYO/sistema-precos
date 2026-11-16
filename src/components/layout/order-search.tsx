"use client";

import { Search, ArrowUpRight, X, ArrowRight, Plus, CalendarPlus, User, Package } from "lucide-react";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useId, useRef, useState } from "react";
import { useApp } from "@/app-state/app-context";
import { QuickOrderAction } from "@/features/orders/quick-order-action";
import { StatusBadge, vehicleLabel } from "@/features/orders/shared";
import { formatOrderNumber, formatPlate } from "@/lib/format";
import { useVisibleModules } from "./app-shell";
import { GO_KEYS } from "./global-shortcuts";

const norm = (s: string) => s.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Linha simples da busca para comandos, clientes e peças (mesma aparência dos resultados de OS). */
function CommandRow({ icon, title, detail, hint, onSelect, disabled }: { icon: ReactNode; title: ReactNode; detail?: ReactNode; hint?: ReactNode; onSelect: () => void; disabled?: boolean }) {
  return (
    <div className="search-result">
      <button type="button" className="search-result-main search-command" onClick={onSelect} disabled={disabled}>
        <span className="search-command-title">
          <span className="search-command-icon" aria-hidden>{icon}</span>
          {title}
        </span>
        {detail && <small>{detail}</small>}
      </button>
      {hint && <span className="search-hint">{hint}</span>}
    </div>
  );
}

export function OrderSearch() {
  const { view, can, settings, online, customerOf, vehicleOf, openOrder, openNewOrder } = useApp();
  const router = useRouter();
  const modules = useVisibleModules();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  useEffect(() => {
    const close = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const keys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); input.current?.focus(); setOpen(true); }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", keys);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", keys); };
  }, []);
  if (!can("os.view") || !settings.activeModules.includes("orders")) return null;
  const q = query.trim().toLocaleLowerCase("pt-BR");
  const nq = norm(q);
  const matches = view.orders.filter((o) => {
    const vehicle = vehicleOf(o.vehicleId);
    return !q || `${formatOrderNumber(o.number)} ${o.number} ${customerOf(o.customerId)?.name ?? ""} ${vehicleLabel(vehicle)} ${vehicle?.plate ?? ""} ${vehicle ? formatPlate(vehicle.plate) : ""}`.toLocaleLowerCase("pt-BR").includes(q);
  }).sort((a, b) => b.openedAt.localeCompare(a.openedAt)).slice(0, 6);

  const go = (fn: () => void) => { setOpen(false); setQuery(""); fn(); };
  const active = (m: string) => settings.activeModules.includes(m as never);

  // Comandos, clientes e peças só aparecem quando há texto digitado, para não encher o painel.
  const actions = !q ? [] : [
    can("os.create") && active("orders") && { key: "nova-os", words: "nova os ordem de servico abrir criar", icon: <Plus size={16} />, title: "Nova ordem de serviço", hint: <kbd>N</kbd>, disabled: !online, run: () => openNewOrder() },
    can("schedule.manage") && active("schedule") && { key: "novo-agendamento", words: "novo agendamento agenda marcar horario", icon: <CalendarPlus size={16} />, title: "Novo agendamento", disabled: !online, run: () => router.push("/agenda?novo=1") },
    ...modules.map((m) => ({ key: m.key, words: `ir para ${m.label}`, icon: <ArrowRight size={16} />, title: `Ir para ${m.label}`, hint: GO_KEYS[m.href] ? <><kbd>G</kbd><kbd>{GO_KEYS[m.href]}</kbd></> : undefined, disabled: false, run: () => router.push(m.href) })),
  ].filter((a): a is Exclude<typeof a, false> => !!a && norm(a.words).includes(nq)).slice(0, 4);
  const customers = q.length < 2 || !can("customers.view") || !active("customers") ? [] : view.customers.filter((c) => norm(c.name).includes(nq) || (q.replace(/\D/g, "").length >= 3 && c.phone.includes(q.replace(/\D/g, "")))).slice(0, 3);
  const parts = q.length < 2 || !can("stock.view") || !active("stock") ? [] : view.parts.filter((p) => norm(`${p.name} ${p.code}`).includes(nq)).slice(0, 3);
  const nothing = matches.length === 0 && actions.length === 0 && customers.length === 0 && parts.length === 0;

  return (
    <div className="order-search" ref={root} onBlur={(e) => { if (e.relatedTarget instanceof Element && e.relatedTarget.closest("dialog")) return; if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <Search size={18} aria-hidden />
      <input ref={input} aria-label="Buscar OS, cliente, peça ou comando" aria-controls={open ? id : undefined} value={query} onChange={(e) => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Buscar placa, cliente, OS ou comando" />
      {query ? <button type="button" aria-label="Limpar busca global" onClick={() => { setQuery(""); input.current?.focus(); }}><X size={16} aria-hidden /></button> : <kbd>Ctrl K</kbd>}
      {open && <div id={id} className="order-search-results">
        {nothing && <p className="search-empty">Nada encontrado. Busque por outra placa, nome, número, peça ou comando.</p>}

        {actions.length > 0 && <>
          <p className="search-caption">Comandos</p>
          {actions.map((a) => <CommandRow key={a.key} icon={a.icon} title={a.title} hint={a.hint} disabled={a.disabled} onSelect={() => go(a.run)} />)}
        </>}

        {matches.length > 0 && <p className="search-caption">{q ? "Ordens de serviço" : "Ordens recentes"}</p>}
        {matches.map((o) => {
          const v = vehicleOf(o.vehicleId);
          return <div key={o.id} className="search-result">
            <button type="button" className="search-result-main" onClick={() => { setOpen(false); openOrder(o.id); }}>
              <span><strong>{formatOrderNumber(o.number)}</strong> <span className="vehicle-plate">{v ? formatPlate(v.plate) : "—"}</span></span>
              <span>{customerOf(o.customerId)?.name}</span>
              <small>{vehicleLabel(v)} <ArrowUpRight size={12} aria-hidden /></small>
            </button>
            <div className="search-result-action"><StatusBadge order={o} /><QuickOrderAction order={o} /></div>
          </div>;
        })}

        {customers.length > 0 && <>
          <p className="search-caption">Clientes</p>
          {customers.map((c) => {
            const plates = view.vehicles.filter((v) => v.customerId === c.id).map((v) => formatPlate(v.plate)).join(", ");
            return <CommandRow key={c.id} icon={<User size={16} />} title={c.name} detail={plates || undefined} onSelect={() => go(() => router.push(`/clientes?q=${encodeURIComponent(c.name)}`))} />;
          })}
        </>}

        {parts.length > 0 && <>
          <p className="search-caption">Peças</p>
          {parts.map((p) => <CommandRow key={p.id} icon={<Package size={16} />} title={p.name} detail={`${p.code} · ${p.quantity} em estoque`} onSelect={() => go(() => router.push(`/estoque?q=${encodeURIComponent(p.code)}`))} />)}
        </>}

        <p className="search-shortcuts"><kbd>N</kbd> nova OS · <kbd>G</kbd> + letra abre um módulo · <kbd>Ctrl Z</kbd> desfaz a última movimentação</p>
      </div>}
    </div>
  );
}
