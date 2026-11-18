"use client";

import { GripHorizontal, PanelTop } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { useApp } from "@/app-state/app-context";
import { BrandMark } from "@/components/ui/brand-mark";
import { cx } from "@/components/ui/primitives";
import type { ModuleInfo } from "@/domain/permissions";
import { NavPill } from "./nav-pill";
import { NAV_ICONS } from "./personal-navigation";

/**
 * Menu na lateral (opcional). O menu do topo pode virar uma barra fixa à esquerda
 * que empurra a página; a logo "voa" do topo para a barra e estoura ao chegar.
 * Animação: View Transitions API (referências: Arc, Safari 18, Linear). Arrastar é
 * só um atalho: Minha conta e "Posicionar navegação" fazem o mesmo (WCAG 2.5.7).
 * Abaixo de 1100 px vale sempre o menu do topo / barra de baixo.
 */

export type NavMode = "top" | "side";
/** Nomes curtos para a barra recolhida (o nome completo fica no título e no leitor de tela). */
const COMPACT: Partial<Record<string, string>> = { customers: "Pessoas", settings: "Ajustes", finance: "Financeiro", reports: "Relatórios" };
const EVENT = "gavyo-navigation";
const WIDE = "(min-width: 1100px)";

const subscribe = (cb: () => void) => {
  const media = window.matchMedia(WIDE);
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  media.addEventListener("change", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); media.removeEventListener("change", cb); };
};
const read = (key: string) => { try { return localStorage.getItem(key) ?? ""; } catch { return ""; } };
const write = (key: string, value: string | null) => {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* preferência só nesta sessão */ }
  window.dispatchEvent(new Event(EVENT));
};

const modeKey = (pref: string) => `gavyo:navigation-mode:v1:${pref}`;

/** Lê o modo salvo e se a tela é larga o bastante para a barra lateral. */
export function useNavMode(pref: string) {
  const saved = useSyncExternalStore(subscribe, () => read(modeKey(pref)), () => "");
  const wide = useSyncExternalStore(subscribe, () => window.matchMedia(WIDE).matches, () => true);
  return { side: saved === "side" && wide, wide };
}

/** A logo da barra lateral "estoura" só quando a pessoa acabou de trocar o modo. */
let popOnMount = false;

/** Troca topo ↔ lateral com a transição animada (quando o navegador suporta e o movimento não está reduzido). */
export function setNavMode(pref: string, mode: NavMode) {
  const apply = () => {
    // A posição flutuante antiga não vale mais depois de escolher topo ou lateral.
    write(`gavyo:navigation-position:v1:${pref}`, null);
    write(modeKey(pref), mode === "side" ? "side" : null);
  };
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduce";
  popOnMount = mode === "side" && !reduced;
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (reduced || !doc.startViewTransition) { apply(); return; }
  document.documentElement.dataset.navSwitch = mode;
  const t = doc.startViewTransition(() => flushSync(apply)) as { finished?: Promise<void> };
  t.finished?.finally(() => { delete document.documentElement.dataset.navSwitch; });
}

export function SideNavigation({ modules, pref }: { modules: ModuleInfo[]; pref: string }) {
  const { settings } = useApp();
  const pathname = usePathname();
  // Recolhida por padrão; abre com o mouse por cima (ou foco do teclado) e fecha ao sair.
  // Pequenos atrasos evitam abrir/fechar quando o mouse só passa por cima.
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const later = (next: boolean, ms: number) => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setOpen(next), ms); };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const compact = !open;
  const list = useRef<HTMLElement>(null);
  const [pop] = useState(popOnMount);
  useEffect(() => { popOnMount = false; }, []);
  const [drag, setDrag] = useState<{ start: number; y: number } | null>(null);
  const dragY = drag?.y ?? null;
  const grip = useRef<{ id: number; y: number; moved: boolean } | null>(null);
  const nearTop = dragY !== null && dragY < 120;

  useEffect(() => {
    const cancel = () => { grip.current = null; setDrag(null); };
    window.addEventListener("blur", cancel);
    return () => window.removeEventListener("blur", cancel);
  }, []);

  const activeOf = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {nearTop && <div className="side-dock-top" role="status">Solte para voltar o menu ao topo</div>}
      <aside
        className={cx("side-nav", compact ? "is-compact" : "is-open", dragY !== null && "is-dragging")}
        aria-label="Menu lateral"
        data-entering={pop || undefined}
        onPointerEnter={(e) => { if (e.pointerType === "mouse") later(true, 120); }}
        onPointerLeave={(e) => { if (e.pointerType === "mouse") later(false, 220); }}
        onFocus={() => later(true, 0)}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) later(false, 0); }} style={drag ? { transform: `translateY(${Math.max(-60, Math.min(drag.y - drag.start, 0))}px)` } : undefined}>
        <div className="side-nav-top">
          <Link href="/inicio" className="side-brand" data-pop={pop || undefined} aria-label={`${settings.displayName} — Hoje`}>
            <span className="side-brand-logo">
              {settings.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={settings.logoDataUrl} alt="" className="app-brand-logo bg-white object-contain" />
              ) : (
                <BrandMark className="app-brand-logo" />
              )}
              <span className="side-burst" aria-hidden><i /><i /><i /><i /><i /><i /><i /><i /></span>
            </span>
            {!compact && (
              <span className="min-w-0">
                <span className="app-brand-name" title={settings.displayName}>{settings.displayName}</span>
                <span className="app-brand-product">GAVYO Auto</span>
              </span>
            )}
          </Link>
          <button
            type="button"
            className="side-grip"
            aria-label="Voltar o menu para o topo (ou arraste até o topo)"
            title="Arraste até o topo para voltar o menu para cima"
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              grip.current = { id: e.pointerId, y: e.clientY, moved: false };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              const g = grip.current; if (!g || g.id !== e.pointerId) return;
              if (!g.moved && Math.abs(e.clientY - g.y) < 6) return;
              g.moved = true;
              setDrag({ start: g.y, y: e.clientY });
            }}
            onPointerUp={(e) => {
              const g = grip.current; grip.current = null;
              const top = e.clientY < 120;
              setDrag(null);
              if (!g?.moved || top) setNavMode(pref, "top");
            }}
            onPointerCancel={() => { grip.current = null; setDrag(null); }}
            onKeyDown={(e) => { if (e.key === "Home" || e.key === "ArrowUp") { e.preventDefault(); setNavMode(pref, "top"); } }}
          >
            <GripHorizontal className="size-4" aria-hidden />
          </button>
        </div>

        <nav ref={list} className="side-nav-list" aria-label="Navegação principal">
          <NavPill container={list} watch={`${pathname}|${compact}`} />
          {modules.map((m, i) => {
            const Icon = NAV_ICONS[m.key];
            const active = activeOf(m.href);
            return (
              <Link key={m.key} href={m.href} data-tour={`nav-${m.key}`} aria-current={active ? "page" : undefined} className={cx("side-nav-item", active && "is-active")} style={{ ["--i" as string]: i }} title={compact ? m.label : undefined} aria-label={compact && COMPACT[m.key] && COMPACT[m.key] !== m.label ? `${COMPACT[m.key]} — ${m.label}` : undefined}>
                <Icon className="side-nav-icon" aria-hidden />
                <span className="side-nav-label">{compact ? (COMPACT[m.key] ?? m.label) : m.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="side-nav-bottom">
          <button type="button" className="side-nav-tool" onClick={() => setNavMode(pref, "top")}>
            <PanelTop className="size-4" aria-hidden />
            <span>{compact ? "Topo" : "Menu no topo"}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
