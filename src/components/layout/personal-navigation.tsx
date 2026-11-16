"use client";

import { BarChart3, Boxes, CalendarDays, CircleDollarSign, ClipboardList, LayoutDashboard, Settings2, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { MovableNavigation } from "./movable-navigation";
import { cx } from "@/components/ui/primitives";
import type { ModuleInfo } from "@/domain/permissions";

const icons = { dashboard: LayoutDashboard, orders: ClipboardList, stock: Boxes, finance: CircleDollarSign, schedule: CalendarDays, customers: Users, reports: BarChart3, settings: Settings2 };
const subscribe = (cb: () => void) => { window.addEventListener("gavyo-navigation", cb); window.addEventListener("storage", cb); return () => { window.removeEventListener("gavyo-navigation", cb); window.removeEventListener("storage", cb); }; };

export function PersonalNavigation({ modules, preferenceKey }: { modules: ModuleInfo[]; preferenceKey: string }) {
  const pathname = usePathname();
  const key = `gavyo:navigation:v1:${preferenceKey}`;
  const raw = useSyncExternalStore(subscribe, () => { try { return localStorage.getItem(key) ?? ""; } catch { return ""; } }, () => "");
  let saved: string[] = [];
  try { const parsed: unknown = JSON.parse(raw); if (Array.isArray(parsed)) saved = parsed.filter((v): v is string => typeof v === "string"); } catch { /* Préférence indisponível: ordem padrão. */ }
  const ordered = [...modules].sort((a, b) => { const ai = saved.indexOf(a.key), bi = saved.indexOf(b.key); return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi); });
  return <MovableNavigation preferenceKey={preferenceKey}>
    <div className="personal-navigation bg-surface text-ink"><div className="personal-nav-inner">
      <nav aria-label="Navegação principal" className="personal-nav-track">{ordered.map(item => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = icons[item.key];
        return <div key={item.key} className={cx("personal-nav-item", active && "is-active")}><Link href={item.href} aria-current={active ? "page" : undefined}><span className="personal-nav-icon"><Icon size={18} aria-hidden /></span>{item.label}</Link></div>;
      })}</nav>
    </div></div>
  </MovableNavigation>;
}
