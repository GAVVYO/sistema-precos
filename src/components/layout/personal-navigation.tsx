"use client";

import { BarChart3, Boxes, CalendarDays, CircleDollarSign, ClipboardList, LayoutDashboard, Settings2, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { MovableNavigation } from "./movable-navigation";
import { cx } from "@/components/ui/primitives";
import { MoreMenu } from "@/components/ui/more-menu";
import type { ModuleInfo } from "@/domain/permissions";

/** Rótulos curtos para caber na ilha; o nome completo fica no título e no "Mais". */
const SHORT: Partial<Record<string, string>> = { orders: "Ordens", customers: "Clientes" };
const VISIBLE = 6;

const icons = { dashboard: LayoutDashboard, orders: ClipboardList, stock: Boxes, finance: CircleDollarSign, schedule: CalendarDays, customers: Users, reports: BarChart3, settings: Settings2 };
const subscribe = (cb: () => void) => { window.addEventListener("gavyo-navigation", cb); window.addEventListener("storage", cb); return () => { window.removeEventListener("gavyo-navigation", cb); window.removeEventListener("storage", cb); }; };

export function PersonalNavigation({ modules, preferenceKey }: { modules: ModuleInfo[]; preferenceKey: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const key = `gavyo:navigation:v1:${preferenceKey}`;
  const raw = useSyncExternalStore(subscribe, () => { try { return localStorage.getItem(key) ?? ""; } catch { return ""; } }, () => "");
  let saved: string[] = [];
  try { const parsed: unknown = JSON.parse(raw); if (Array.isArray(parsed)) saved = parsed.filter((v): v is string => typeof v === "string"); } catch { /* Préférence indisponível: ordem padrão. */ }
  const ordered = [...modules].sort((a, b) => { const ai = saved.indexOf(a.key), bi = saved.indexOf(b.key); return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi); });
  // Na ilha cabem 6 módulos; os demais vão para "Mais" (a tela atual sempre fica à vista).
  const activeOf = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  let shown = ordered.slice(0, VISIBLE);
  let more = ordered.slice(VISIBLE);
  const hiddenActive = more.find((m) => activeOf(m.href));
  if (hiddenActive) {
    more = [shown[shown.length - 1], ...more.filter((m) => m !== hiddenActive)];
    shown = [...shown.slice(0, -1), hiddenActive];
  }
  return <MovableNavigation preferenceKey={preferenceKey}>
    <div className="personal-navigation bg-surface text-ink"><div className="personal-nav-inner">
      <nav aria-label="Navegação principal" className="personal-nav-track">{shown.map(item => {
        const active = activeOf(item.href);
        const Icon = icons[item.key];
        const label = SHORT[item.key] ?? item.label;
        return <div key={item.key} className={cx("personal-nav-item", active && "is-active")}><Link href={item.href} aria-current={active ? "page" : undefined} title={label !== item.label ? item.label : undefined}><span className="personal-nav-icon"><Icon size={18} aria-hidden /></span><span className="personal-nav-label">{label}</span></Link></div>;
      })}
      {more.length > 0 && (
        <div className="personal-nav-item personal-nav-more">
          <MoreMenu text="Mais" label="Mais módulos" items={more.map((m) => { const Icon = icons[m.key]; return { label: m.label, icon: <Icon size={16} />, onSelect: () => router.push(m.href) }; })} />
        </div>
      )}
      </nav>
    </div></div>
  </MovableNavigation>;
}
