"use client";

import { BarChart3, Boxes, CalendarDays, CircleDollarSign, ClipboardList, LayoutDashboard, Settings2, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useSyncExternalStore } from "react";
import { NavPill } from "./nav-pill";
import { MovableNavigation } from "./movable-navigation";
import { setNavMode, useNavMode } from "./side-navigation";
import { cx } from "@/components/ui/primitives";
import { MoreMenu } from "@/components/ui/more-menu";
import type { ModuleInfo } from "@/domain/permissions";

/** Rótulos curtos para caber na ilha; o nome completo fica no título e no "Mais". */
const SHORT: Partial<Record<string, string>> = { customers: "Pessoas" };
/** Na barra do celular, nomes longos ficam curtos (o nome inteiro segue no title e no leitor de tela). */
const TINY: Partial<Record<string, string>> = { reports: "Números", settings: "Ajustes" };
/** Quantas abas cabem com o nome escrito: celular 4, tablet 6, notebook/desktop todas. O resto vai para "Mais". */
const WIDTHS = ["(max-width: 767px)", "(max-width: 1099px)"];
const visibleFor = () => (typeof window === "undefined" ? 6 : window.matchMedia(WIDTHS[0]).matches ? 4 : window.matchMedia(WIDTHS[1]).matches ? 6 : 8);
const subscribeWidth = (cb: () => void) => { const lists = WIDTHS.map((q) => window.matchMedia(q)); lists.forEach((l) => l.addEventListener("change", cb)); return () => lists.forEach((l) => l.removeEventListener("change", cb)); };

export const NAV_ICONS = { dashboard: LayoutDashboard, orders: ClipboardList, stock: Boxes, finance: CircleDollarSign, schedule: CalendarDays, customers: Users, reports: BarChart3, settings: Settings2 };
const subscribe = (cb: () => void) => { window.addEventListener("gavyo-navigation", cb); window.addEventListener("storage", cb); return () => { window.removeEventListener("gavyo-navigation", cb); window.removeEventListener("storage", cb); }; };

export function PersonalNavigation({ modules, preferenceKey }: { modules: ModuleInfo[]; preferenceKey: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const key = `gavyo:navigation:v1:${preferenceKey}`;
  const raw = useSyncExternalStore(subscribe, () => { try { return localStorage.getItem(key) ?? ""; } catch { return ""; } }, () => "");
  let saved: string[] = [];
  try { const parsed: unknown = JSON.parse(raw); if (Array.isArray(parsed)) saved = parsed.filter((v): v is string => typeof v === "string"); } catch { /* Préférence indisponível: ordem padrão. */ }
  const ordered = [...modules].sort((a, b) => { const ai = saved.indexOf(a.key), bi = saved.indexOf(b.key); return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi); });
  // Os módulos que não cabem vão para "Mais" (a tela atual sempre fica à vista).
  const VISIBLE = useSyncExternalStore(subscribeWidth, visibleFor, () => 6);
  const activeOf = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  let shown = ordered.slice(0, VISIBLE);
  let more = ordered.slice(VISIBLE);
  const hiddenActive = more.find((m) => activeOf(m.href));
  if (hiddenActive) {
    more = [shown[shown.length - 1], ...more.filter((m) => m !== hiddenActive)];
    shown = [...shown.slice(0, -1), hiddenActive];
  }
  const { wide } = useNavMode(preferenceKey);
  const track = useRef<HTMLElement>(null);
  return <MovableNavigation preferenceKey={preferenceKey} onDockSide={wide ? () => setNavMode(preferenceKey, "side") : undefined}>
    <div className="personal-navigation bg-surface text-ink"><div className="personal-nav-inner">
      <nav ref={track} aria-label="Navegação principal" className="personal-nav-track"><NavPill container={track} watch={`${pathname}|${shown.map((m) => m.key).join()}|${VISIBLE}`} />{shown.map(item => {
        const active = activeOf(item.href);
        const Icon = NAV_ICONS[item.key];
        const label = SHORT[item.key] ?? item.label;
        return <div key={item.key} className={cx("personal-nav-item", active && "is-active")}><Link href={item.href} data-tour={`nav-${item.key}`} aria-current={active ? "page" : undefined} title={label !== item.label ? item.label : undefined}><span className="personal-nav-icon"><Icon size={18} aria-hidden /></span><span className="personal-nav-label">{TINY[item.key] ? <><span className="nav-full">{label}</span><span className="nav-tiny" aria-hidden>{TINY[item.key]}</span></> : label}</span></Link></div>;
      })}
      {more.length > 0 && (
        <div className="personal-nav-item personal-nav-more">
          <MoreMenu text="Mais" label="Mais módulos" items={more.map((m) => { const Icon = NAV_ICONS[m.key]; return { label: m.label, icon: <Icon size={16} />, onSelect: () => router.push(m.href) }; })} />
        </div>
      )}
      </nav>
    </div></div>
  </MovableNavigation>;
}
