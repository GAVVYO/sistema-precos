"use client";

import { writePref } from "@/lib/prefs";
import {
  Bell, CalendarClock, ChevronDown, CircleDollarSign, FlaskConical, LayoutDashboard, Lightbulb, Lock, MonitorPlay, PanelLeft, PanelTop, Settings2, LogOut, PackageX, Plus, RotateCcw, Wifi, WifiOff, Wrench,
} from "lucide-react";
import Link from "next/link";
import { setNavMode, SideNavigation, useNavMode } from "./side-navigation";
import { withTransition } from "@/lib/view-transition";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useApp } from "@/app-state/app-context";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Button, cx, EmptyState } from "@/components/ui/primitives";
import { PersonalNavigation } from "./personal-navigation";
import { OrderSearch } from "./order-search";
import { GlobalShortcuts } from "./global-shortcuts";
import { TrayDock, TrayProvider } from "./tray";
import { PipProvider } from "./pip";
import { BrandMark } from "@/components/ui/brand-mark";
import { toast } from "@/components/ui/toast";
import { demoStore } from "@/demo/store";
import { ModuleInfo, MODULES, ROLE_LABELS } from "@/domain/permissions";
import type { ModuleKey } from "@/domain/types";
import { formatDateTime, todayISO } from "@/lib/format";
import { AccessibilityControls } from "@/components/accessibility/accessibility-controls";
import { useAccessibility } from "@/components/accessibility/accessibility-provider";
import { contrastOn, readableAccent } from "@/lib/theme";
import { listReceivables } from "@/services/finance";
import { partSituation } from "@/services/stock";

export function useVisibleModules(): ModuleInfo[] {
  const { settings, can } = useApp();
  return MODULES.filter(
    (m) => !m.hidden && settings.activeModules.includes(m.key) && (m.anyOf.length === 0 || m.anyOf.some(can)),
  );
}

function Menu({
  label,
  button,
  children,
  align = "right",
  buttonClassName,
}: {
  label: string;
  button: ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <button
        type="button"
        aria-label={label}
        ref={trigger}
        aria-controls={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={buttonClassName}
      >
        {button}
      </button>
      {open && (
        <div
          id={id}
          role="region"
          aria-label={label}
          className={cx(
            "absolute top-full z-40 mt-1.5 min-w-56 rounded-md border border-line bg-surface py-1 text-ink shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function DemoBar() {
  const { db, view, user, membership, connection } = useApp();
  const router = useRouter();
  const [confirmReset, setConfirmReset] = useState(false);
  const selectClass = "h-6 rounded border border-amber-300 bg-white px-1 text-xs text-ink";

  const switchWorkshop = (workshopId: string) => {
    const owner = db.memberships.find((m) => m.workshopId === workshopId && m.active && m.role === "owner");
    if (!owner) return;
    // A cor da oficina nova "varre" a tela a partir da logo.
    const logo = document.querySelector(".side-brand-logo .app-brand-logo, .island-brand .app-brand-logo")?.getBoundingClientRect();
    const x = logo ? `${logo.left + logo.width / 2}px` : "40px", y = logo ? `${logo.top + logo.height / 2}px` : "40px";
    writePref("device-workshop", workshopId); // ao sair, a entrada mostra esta oficina
    withTransition("workshop", () => demoStore.login(workshopId, owner.userId), { vars: { "--vt-x": x, "--vt-y": y } });
    router.push("/inicio");
  };

  return (
    <aside aria-label="Ambiente de demonstração" className="demo-bar no-print flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-amber-200 bg-amber-50 px-6 py-1.5 text-xs text-amber-900">
      <span className="flex items-center gap-1.5 font-semibold">
        <FlaskConical className="size-3.5" aria-hidden />
        Ambiente de demonstração — dados fictícios
      </span>
      <label className="flex items-center gap-1.5">
        Oficina
        <select aria-label="Oficina" className={selectClass} value={view.workshop?.id} onChange={(e) => switchWorkshop(e.target.value)}>
          {db.workshops.map((w) => (
            <option key={w.id} value={w.id}>
              {db.settings.find((s) => s.workshopId === w.id)?.displayName ?? w.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5">
        Entrar como
        <select
          aria-label="Entrar como"
          className={selectClass}
          value={user.id}
          onChange={(e) => {
            demoStore.login(membership.workshopId, e.target.value);
            router.push("/inicio");
          }}
        >
          {view.memberships
            .filter((m) => m.active)
            .map((m) => (
              <option key={m.id} value={m.userId}>
                {view.users.find((u) => u.id === m.userId)?.name} — {ROLE_LABELS[m.role]}
              </option>
            ))}
        </select>
      </label>
      {/* Opções de teste ficam recolhidas para não confundir quem usa no dia a dia. */}
      <details className="demo-options ml-auto">
        <summary className="flex cursor-pointer items-center gap-1 font-medium"><Settings2 className="size-3.5" aria-hidden />Opções da demonstração</summary>
        <div className="demo-options-panel">
        <button
          type="button"
          className="flex items-center gap-1 font-medium underline-offset-2 hover:underline"
          onClick={() => demoStore.setOnline(connection === "offline")}
          disabled={connection === "reconnecting"}
        >
          {connection === "offline" ? <Wifi className="size-3.5" aria-hidden /> : <WifiOff className="size-3.5" aria-hidden />}
          {connection === "offline" ? "Restabelecer conexão" : "Simular queda de conexão"}
        </button>
        <button
          type="button"
          className="flex items-center gap-1 font-medium underline-offset-2 hover:underline"
          onClick={() => setConfirmReset(true)}
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Restaurar demonstração
        </button>
        </div>
      </details>
      {confirmReset && (
        <ConfirmDialog
          title="Restaurar demonstração"
          message="Todos os registros criados ou alterados nas duas oficinas fictícias serão apagados e os dados iniciais serão recarregados. Esta ação não pode ser desfeita."
          confirmLabel="Restaurar dados iniciais"
          danger
          onClose={() => setConfirmReset(false)}
          onConfirm={() => {
            demoStore.resetDemo();
            toast("success", "Demonstração restaurada.");
            router.push("/inicio");
          }}
        />
      )}
    </aside>
  );
}

function Notifications() {
  const { view, can, settings, user } = useApp();
  const active = (m: ModuleKey) => settings.activeModules.includes(m);
  const today = todayISO();
  const items: { icon: ReactNode; text: string; href: string }[] = [];

  if (can("stock.view") && active("stock")) {
    const low = view.parts.filter((p) => partSituation(p) !== "ok").length;
    if (low) items.push({ icon: <PackageX className="size-4 text-warning" aria-hidden />, text: `${low} ${low === 1 ? "peça" : "peças"} com estoque baixo ou zerado`, href: "/estoque" });
  }
  if (can("finance.view") && active("finance")) {
    const n = listReceivables(view).length;
    if (n) items.push({ icon: <CircleDollarSign className="size-4 text-primary" aria-hidden />, text: `${n} ${n === 1 ? "conta" : "contas"} a receber`, href: "/financeiro" });
  }
  if (can("schedule.manage") && active("schedule")) {
    const n = view.appointments.filter((a) => a.date === today && (a.status === "scheduled" || a.status === "confirmed")).length;
    if (n) items.push({ icon: <CalendarClock className="size-4 text-primary" aria-hidden />, text: `${n} ${n === 1 ? "agendamento" : "agendamentos"} para hoje`, href: "/agenda" });
  }
  if (can("os.view") && active("orders")) {
    const n = view.orders.filter((o) => !o.cancelledAt && o.status === "waiting" && o.mechanicId === user.id).length;
    if (n) items.push({ icon: <Wrench className="size-4 text-muted" aria-hidden />, text: `${n} ${n === 1 ? "serviço aguardando" : "serviços aguardando"} você`, href: "/ordens" });
  }

  return (
    <Menu
      label={items.length ? `Avisos, ${items.length} ${items.length === 1 ? "novo" : "novos"}` : "Avisos"}
      buttonClassName="topbar-icon topbar-labeled"
      button={
        <>
          <span className="relative inline-flex"><Bell className="size-5" aria-hidden />
          {/* O número vem do CSS (data-count): o nome lido começa por "Avisos", igual ao texto visível. */}
          {items.length > 0 && <span className="topbar-badge" data-count={items.length} aria-hidden />}</span>
          <span className="topbar-label" aria-hidden>Avisos</span>
        </>
      }
    >
      {(close) =>
        items.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted">Nenhum aviso agora.</p>
        ) : (
          items.map((it) => (
            <Link key={it.href} href={it.href} onClick={close} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50">
              {it.icon}
              {it.text}
            </Link>
          ))
        )
      }
    </Menu>
  );
}


function Header() {
  const { settings, user, membership, connection, online, can, openNewOrder } = useApp();
  const router = useRouter();
  const modules = useVisibleModules();
  const pref = `${membership.workshopId}:${user.id}`;
  const nav = useNavMode(pref);
  // Encolhe as cápsulas ao rolar (como as barras do iOS 26).
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    // Encolher muda a altura da página; numa página curta isso devolvia a rolagem
    // para cima e o cabeçalho ficava abrindo e fechando sem parar (tremendo).
    // Por isso: só encolhe se a página tiver rolagem de sobra, e com folga
    // (encolhe depois de 64 px, só volta abaixo de 8 px).
    const onScroll = () => {
      const room = document.documentElement.scrollHeight - window.innerHeight;
      const y = window.scrollY;
      setCompact((was) => (was ? y > 8 : room >= 200 && y > 64));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const conn = {
    online: { label: "Online", dot: "bg-emerald-400" },
    offline: { label: "Sem internet", dot: "bg-red-400" },
    reconnecting: { label: "Reconectando…", dot: "bg-amber-400 animate-pulse" },
  }[connection];

  return (
    <header className={cx("island-header no-print", compact && "is-compact", nav.side && "is-side")}>
      {/* Ilha flutuante (referência: Liquid Glass do macOS Tahoe/iOS 26 e barras flutuantes do Safari 26):
          três cápsulas sobre a página — oficina, menu e ferramentas. Encolhem ao rolar. */}
        {!nav.side && <Link href="/inicio" className="island island-brand app-brand">
          <span className="sr-only">Ir para o Hoje: </span>
          {settings.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logoDataUrl} alt="" className="app-brand-logo bg-white object-contain" />
          ) : (
            <BrandMark className="app-brand-logo" />
          )}
          <span className="min-w-0">
            <span className="app-brand-name" title={settings.displayName}>{settings.displayName}</span>
            <span className="app-brand-product">GAVYO Auto</span>
          </span>
        </Link>}
      <div className="island-search-slot"><OrderSearch /></div>
      {!nav.side && <PersonalNavigation modules={modules} preferenceKey={pref} />}
      <div className="island island-actions">
        <div className="island-tools">
          {can("os.create") && settings.activeModules.includes("orders") && (
            <Button data-tour="new-order" variant="primary" size="sm" className="topbar-primary" icon={<Plus className="size-4" aria-hidden />} disabled={!online} onClick={() => openNewOrder()} aria-keyshortcuts="N" title="Novo serviço (N)">
              <span className="topbar-primary-label">Novo serviço</span>
            </Button>
          )}
          {/* Conexão: só aparece escrita quando não está online (a faixa vermelha explica o resto). */}
          <span className={cx("topbar-status", connection === "online" && "sr-only")} role="status" aria-live="polite">
            <span className={cx("size-2 rounded-full", conn.dot)} aria-hidden />
            {conn.label}
          </span>
          <span className="topbar-sep" aria-hidden />
          <AccessibilityControls />
          <Notifications />
          <Menu
            label={`Minha conta — ${user.name}, ${ROLE_LABELS[membership.role]}`}
            buttonClassName="topbar-account"
            button={
              <>
                <span className="topbar-avatar" data-initials={user.name.split(" ").slice(0, 2).map((p) => p[0]).join("")}>
                  <span className={cx("topbar-avatar-dot", conn.dot)} aria-hidden />
                </span>
                <span className="topbar-label" aria-hidden>Minha conta</span>
                <ChevronDown className="size-4 opacity-70" aria-hidden />
              </>
            }
          >
            {(close) => (
              <>
                <div className="border-b border-line px-3 py-2.5">
                  <p className="text-sm font-semibold">{user.name}</p>
                  <p className="text-sm text-muted">{ROLE_LABELS[membership.role]} · {settings.displayName}</p>
                  <p className="text-sm text-muted">{user.email}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><span className={cx("size-2 rounded-full", conn.dot)} aria-hidden />{conn.label}</p>
                </div>
                {nav.wide && (
                  <button type="button" role="menuitem" className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-slate-50" onClick={() => { close(); setNavMode(pref, nav.side ? "top" : "side"); }}>
                    {nav.side ? <PanelTop className="size-4" aria-hidden /> : <PanelLeft className="size-4" aria-hidden />}
                    {nav.side ? "Menu no topo" : "Menu na lateral"}
                  </button>
                )}
                {can("os.view") && settings.activeModules.includes("orders") && (
                  <a role="menuitem" href="/tv" target="_blank" rel="noopener" onClick={close} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-slate-50">
                    <MonitorPlay className="size-4" aria-hidden />
                    Modo TV da parede
                  </a>
                )}
                {membership.role === "financial" && (
                  <Link role="menuitem" href="/inicio?organizar=1" onClick={close} className="widget-customize flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-slate-50">
                    <LayoutDashboard className="size-4" aria-hidden />
                    Organizar tela inicial
                  </Link>
                )}
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                  onClick={() => {
                    close();
                    // Apaga só as dicas já vistas por esta pessoa nesta oficina e mostra de novo.
                    const suffix = `:${membership.workshopId}:${user.id}`;
                    try {
                      Object.keys(localStorage).filter((k) => k.startsWith("gavyo:prefs:tip:") && k.endsWith(suffix)).forEach((k) => localStorage.removeItem(k));
                    } catch { /* sem armazenamento: nada a limpar */ }
                    window.location.reload();
                  }}
                >
                  <Lightbulb className="size-4" aria-hidden />
                  Ver as dicas de novo
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                  onClick={() => {
                    close();
                    demoStore.logout();
                    router.replace("/login");
                  }}
                >
                  <LogOut className="size-4" aria-hidden />
                  Sair
                </button>
              </>
            )}
          </Menu>
        </div>
      </div>
    </header>
  );
}

function ConnectionBanner() {
  const { connection, lastSyncAt } = useApp();
  if (connection === "online") return null;
  return (
    <div role="alert" className="no-print flex items-center justify-center gap-2 border-b border-red-200 bg-danger-soft px-4 py-1.5 text-sm text-danger">
      <WifiOff className="size-4" aria-hidden />
      {connection === "offline" ? (
        <span>
          <strong>Sem internet.</strong> Você pode consultar (dados de {formatDateTime(lastSyncAt)}). Abrir serviço, mudar etapa, receber e mexer no estoque voltam quando a internet voltar.
        </span>
      ) : (
        <span>Internet voltando. Atualizando os dados…</span>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { settings, user, membership } = useApp();
  const { preferences } = useAccessibility();
  const pathname = usePathname();
  const main = useRef<HTMLElement>(null);
  const modules = useVisibleModules();
  const pref = `${membership.workshopId}:${user.id}`;
  const nav = useNavMode(pref);

  useEffect(() => { main.current?.focus({ preventScroll: true }); }, [pathname]);

  useLayoutEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--primary", readableAccent(settings.primaryColor, preferences.contrast ? 7 : 5.5));
    root.setProperty("--primary-fg", contrastOn(readableAccent(settings.primaryColor, preferences.contrast ? 7 : 5.5)));
    root.setProperty("--secondary", settings.secondaryColor);
    root.setProperty("--secondary-fg", contrastOn(settings.secondaryColor));
    return () => {
      for (const v of ["--primary", "--primary-fg", "--secondary", "--secondary-fg"]) root.removeProperty(v);
    };
  }, [settings.primaryColor, settings.secondaryColor, preferences.contrast]);

  useEffect(() => {
    const on = () => demoStore.setOnline(true);
    const off = () => demoStore.setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // TV da parede: tela cheia, sem cabeçalho, barra da demonstração nem bandeja.
  if (pathname === "/tv" || pathname.startsWith("/tv/")) {
    return <main id="conteudo" className="tv-frame">{children}</main>;
  }

  return (
    <TrayProvider>
    <PipProvider>
    <div className={cx("app-frame flex min-h-screen flex-col", nav.side && "with-sidebar")}>
      {nav.side && <SideNavigation modules={modules} pref={pref} />}
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <DemoBar />
      <Header />
      <ConnectionBanner />
      <GlobalShortcuts />
      <main ref={main} tabIndex={-1} id="conteudo" className="app-main mx-auto w-full max-w-[1600px] flex-1 px-6 py-6">
        <div key={pathname} className="page-enter">{children}</div>
      </main>
      {/* Nas Ordens, a bandeja é renderizada dentro do quadro para aceitar arraste. */}
      {pathname !== "/ordens" && <TrayDock />}
    </div>
    </PipProvider>
    </TrayProvider>
  );
}

/** Bloqueia a tela quando o módulo está desativado ou o usuário não tem permissão. */
export function ModuleGuard({ module, children }: { module: ModuleKey; children: ReactNode }) {
  const { settings, can } = useApp();
  const info = MODULES.find((m) => m.key === module)!;
  if (!settings.activeModules.includes(module)) {
    return (
      <div className="rounded-md border border-line bg-surface">
        <h1 className="sr-only">{info.label}</h1>
        <EmptyState icon={<Lock className="size-8" aria-hidden />} title="Módulo desativado" description={`O módulo ${info.label} não está ativo para esta oficina. O proprietário pode ativá-lo em Configurações.`} />
      </div>
    );
  }
  if (info.anyOf.length > 0 && !info.anyOf.some(can)) {
    return (
      <div className="rounded-md border border-line bg-surface">
        <h1 className="sr-only">{info.label}</h1>
        <EmptyState icon={<Lock className="size-8" aria-hidden />} title="Permissão insuficiente" description={`Seu usuário não tem acesso a ${info.label}. Fale com o proprietário da oficina se precisar deste acesso.`} />
      </div>
    );
  }
  return <>{children}</>;
}
