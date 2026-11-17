"use client";

import {
  Bell, CalendarClock, ChevronDown, CircleDollarSign, FlaskConical, Lock, LogOut, PackageX, Plus, RotateCcw, Wifi, WifiOff, Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useId, useRef, useState } from "react";
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
    (m) => settings.activeModules.includes(m.key) && (m.anyOf.length === 0 || m.anyOf.some(can)),
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
    demoStore.login(workshopId, owner.userId);
    router.push("/inicio");
  };

  return (
    <div className="demo-bar no-print flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-amber-200 bg-amber-50 px-6 py-1.5 text-xs text-amber-900">
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
      <div className="ml-auto flex items-center gap-3">
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
    </div>
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
    if (n) items.push({ icon: <Wrench className="size-4 text-muted" aria-hidden />, text: `${n} OS aguardando você`, href: "/ordens" });
  }

  return (
    <Menu
      label={`Notificações (${items.length})`}
      buttonClassName="topbar-icon"
      button={
        <>
          <Bell className="size-5" aria-hidden />
          {items.length > 0 && <span className="topbar-badge" aria-hidden>{items.length}</span>}
        </>
      }
    >
      {(close) =>
        items.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted">Nenhuma notificação no momento.</p>
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
  // Encolhe as cápsulas ao rolar (como as barras do iOS 26).
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const conn = {
    online: { label: "Online", dot: "bg-emerald-400" },
    offline: { label: "Offline", dot: "bg-red-400" },
    reconnecting: { label: "Reconectando…", dot: "bg-amber-400 animate-pulse" },
  }[connection];

  return (
    <header className={cx("island-header no-print", compact && "is-compact")}>
      {/* Ilha flutuante (referência: Liquid Glass do macOS Tahoe/iOS 26 e barras flutuantes do Safari 26):
          três cápsulas sobre a página — oficina, menu e ferramentas. Encolhem ao rolar. */}
        <Link href="/inicio" className="island island-brand app-brand" aria-label={`${settings.displayName} — início`}>
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
        </Link>
      <PersonalNavigation modules={modules} preferenceKey={`${membership.workshopId}:${user.id}`} />
      <div className="island island-actions">
        <OrderSearch />
        <div className="island-tools">
          {can("os.create") && settings.activeModules.includes("orders") && (
            <Button variant="primary" size="sm" className="topbar-primary" icon={<Plus className="size-4" aria-hidden />} disabled={!online} onClick={() => openNewOrder()} aria-keyshortcuts="N" title="Nova OS (N)">
              <span className="topbar-primary-label">Nova OS</span>
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
            label={`Conta de ${user.name} (${ROLE_LABELS[membership.role]})`}
            buttonClassName="topbar-account"
            button={
              <>
                <span className="topbar-avatar">
                  {user.name.split(" ").slice(0, 2).map((p) => p[0]).join("")}
                  <span className={cx("topbar-avatar-dot", conn.dot)} aria-hidden />
                </span>
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
          <strong>Você está offline.</strong> Exibindo dados carregados em {formatDateTime(lastSyncAt)}. Criação, edição, pagamentos e movimentações estão bloqueados até a conexão voltar.
        </span>
      ) : (
        <span>Reconectando e atualizando os dados…</span>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { settings } = useApp();
  const { preferences } = useAccessibility();
  const pathname = usePathname();
  const main = useRef<HTMLElement>(null);

  useEffect(() => { main.current?.focus({ preventScroll: true }); }, [pathname]);

  useEffect(() => {
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

  return (
    <TrayProvider>
    <PipProvider>
    <div className="flex min-h-screen flex-col">
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
        <EmptyState icon={<Lock className="size-8" aria-hidden />} title="Módulo desativado" description={`O módulo ${info.label} não está ativo para esta oficina. O proprietário pode ativá-lo em Configurações.`} />
      </div>
    );
  }
  if (info.anyOf.length > 0 && !info.anyOf.some(can)) {
    return (
      <div className="rounded-md border border-line bg-surface">
        <EmptyState icon={<Lock className="size-8" aria-hidden />} title="Permissão insuficiente" description={`Seu usuário não tem acesso a ${info.label}. Fale com o proprietário da oficina se precisar deste acesso.`} />
      </div>
    );
  }
  return <>{children}</>;
}
