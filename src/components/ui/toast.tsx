"use client";

import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { cx } from "./primitives";

interface ToastAction {
  label: string;
  run: () => void;
}

interface Toast {
  id: number;
  kind: "success" | "error";
  message: string;
  action?: ToastAction;
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const EMPTY: Toast[] = [];

function emit() {
  listeners.forEach((l) => l());
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/* Desfazer (Ctrl+Z / ⌘Z), como no macOS: vale para a última ação que ofereceu desfazer. */
let pendingUndo: { id: number; run: () => void } | null = null;

export function runUndo(): boolean {
  if (!pendingUndo) return false;
  const { id, run } = pendingUndo;
  pendingUndo = null;
  dismiss(id);
  run();
  return true;
}

export function toast(kind: Toast["kind"], message: string, action?: ToastAction) {
  const id = nextId++;
  toasts = [...toasts.slice(-3), { id, kind, message, action }];
  emit();
  if (action) pendingUndo = { id, run: action.run };
  setTimeout(() => {
    dismiss(id);
    if (pendingUndo?.id === id) pendingUndo = null;
  }, kind === "error" ? 7000 : action ? 8000 : 4000);
}

/**
 * Região de avisos. Usa a top layer (popover) para ficar acima dos modais
 * nativos; é reaberta a cada aviso para subir ao topo da pilha.
 */
export function Toaster() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
    () => EMPTY,
  );
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.showPopover !== "function") return;
    try {
      if (el.matches(":popover-open")) el.hidePopover();
      if (list.length) el.showPopover();
    } catch {
      // Navegador sem suporte a popover: os avisos seguem visíveis fora de modais.
    }
  }, [list]);

  return (
    <div
      ref={ref}
      popover="manual"
      role="region"
      aria-label="Avisos"
      className="fixed inset-auto right-4 bottom-4 m-0 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 overflow-visible border-0 bg-transparent p-0"
    >
      {list.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className={cx(
            "toast-enter flex items-start gap-2 rounded-md border bg-surface px-3 py-2.5 text-sm text-ink shadow-lg",
            t.kind === "error" ? "border-danger/40" : "border-success/40",
          )}
        >
          {t.kind === "error" ? (
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          ) : (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          )}
          <span className="flex-1">{t.message}</span>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                if (pendingUndo?.id === t.id) pendingUndo = null;
                dismiss(t.id);
                t.action!.run();
              }}
              className="-my-1 shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-primary hover:bg-primary-soft"
            >
              {t.action.label}
            </button>
          )}
          <button type="button" onClick={() => dismiss(t.id)} aria-label="Dispensar aviso" className="inline-flex size-8 shrink-0 items-center justify-center rounded text-muted hover:text-ink">
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
