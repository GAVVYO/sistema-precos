"use client";

import { Search, ArrowUpRight, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useApp } from "@/app-state/app-context";
import { QuickOrderAction } from "@/features/orders/quick-order-action";
import { StatusBadge, vehicleLabel } from "@/features/orders/shared";
import { formatOrderNumber, formatPlate } from "@/lib/format";

export function OrderSearch() {
  const { view, can, settings, customerOf, vehicleOf, openOrder } = useApp();
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
  const matches = view.orders.filter((o) => {
    const vehicle = vehicleOf(o.vehicleId);
    return !q || `${formatOrderNumber(o.number)} ${o.number} ${customerOf(o.customerId)?.name ?? ""} ${vehicleLabel(vehicle)} ${vehicle?.plate ?? ""} ${vehicle ? formatPlate(vehicle.plate) : ""}`.toLocaleLowerCase("pt-BR").includes(q);
  }).sort((a, b) => b.openedAt.localeCompare(a.openedAt)).slice(0, 6);
  return (
    <div className="order-search" ref={root} onBlur={(e) => { if (e.relatedTarget instanceof Element && e.relatedTarget.closest("dialog")) return; if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <Search size={18} aria-hidden />
      <input ref={input} aria-label="Buscar OS por placa, cliente ou número" aria-controls={open ? id : undefined} value={query} onChange={(e) => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Buscar placa, cliente ou OS" />
      {query ? <button type="button" aria-label="Limpar busca global" onClick={() => { setQuery(""); input.current?.focus(); }}><X size={16} aria-hidden /></button> : <kbd>Ctrl K</kbd>}
      {open && <div id={id} className="order-search-results">
        <p className="search-caption">{q ? "Resultados da busca" : "Ordens recentes"}</p>
        {matches.length === 0 ? <p className="search-empty">Nenhuma OS encontrada. Busque por outra placa, nome ou número.</p> : matches.map((o) => {
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
      </div>}
    </div>
  );
}
