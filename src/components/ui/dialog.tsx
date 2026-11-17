"use client";

import { X } from "lucide-react";
import { ReactNode, useEffect, useId, useRef, useState } from "react";
import { Button, cx } from "./primitives";

const SIZES = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl" };

/**
 * Modal baseado em <dialog> nativo: foco preso, Esc para fechar e leitura
 * correta por leitores de tela. Deve ser montado apenas enquanto aberto.
 */
export function Dialog({
  title,
  subtitle,
  onClose,
  size = "md",
  children,
  footer,
  className,
}: {
  className?: string;
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  size?: keyof typeof SIZES;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const subtitleId = useId();

  useEffect(() => {
    const el = ref.current;
    const previous = document.activeElement;
    if (el && !el.open) el.showModal();
    return () => {
      el?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={subtitle ? subtitleId : undefined}
      onKeyDown={event => {
        // Mantém o ciclo dentro da janela inclusive em navegadores que enviam
        // o foco ao chrome do navegador no fim da sequência nativa.
        if (event.key !== "Tab") return;
        const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        )).filter(item => item.tabIndex >= 0 && item.getClientRects().length > 0);
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={cx(
        "app-dialog m-auto w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface p-0 text-ink shadow-xl",
        "max-h-[calc(100vh-2rem)] open:flex open:flex-col",
        SIZES[size],
        className,
      )}
    >
      <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
        <div className="min-w-0">
          <h2 id={titleId} className="text-base font-semibold break-words">{title}</h2>
          {subtitle && <div id={subtitleId} className="mt-0.5 text-sm text-muted">{subtitle}</div>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="dialog-close inline-flex size-11 shrink-0 items-center justify-center rounded text-muted hover:bg-slate-100 hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      {footer && (
        <footer className="dialog-actions flex flex-wrap items-center justify-end gap-3 border-t border-line bg-slate-50 px-6 py-4">
          {footer}
        </footer>
      )}
    </dialog>
  );
}

/** Confirmação de ações destrutivas ou irreversíveis. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
  children,
}: {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void | boolean;
  onClose: () => void;
  children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      title={title}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Voltar</Button>
          <Button
            variant={danger ? "danger" : "primary"}
            loading={busy}
            onClick={() => {
              setBusy(true);
              const keepOpen = onConfirm() === false;
              setBusy(false);
              if (!keepOpen) onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-ink">{message}</div>
      {children}
    </Dialog>
  );
}
