"use client";

import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { cx } from "./primitives";

interface Toast {
  id: number;
  kind: "success" | "error";
  message: string;
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

export function toast(kind: Toast["kind"], message: string) {
  const id = nextId++;
  toasts = [...toasts.slice(-3), { id, kind, message }];
  emit();
  setTimeout(() => dismiss(id), kind === "error" ? 7000 : 4000);
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
            "toast-enter flex items-start gap-2 rounded-md border bg-surface px-3 py-2.5 text-[13px] text-ink shadow-lg",
            t.kind === "error" ? "border-danger/40" : "border-success/40",
          )}
        >
          {t.kind === "error" ? (
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          ) : (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          )}
          <span className="flex-1">{t.message}</span>
          <button type="button" onClick={() => dismiss(t.id)} aria-label="Dispensar aviso" className="text-muted hover:text-ink">
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
