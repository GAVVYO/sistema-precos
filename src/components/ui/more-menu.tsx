"use client";

import { MoreHorizontal } from "lucide-react";
import { ReactNode, useId, useRef } from "react";
import { cx } from "./primitives";

export interface MoreMenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  /** Título de grupo exibido antes deste item (ex.: "Mover para"). */
  group?: string;
  danger?: boolean;
}

/**
 * Menu "⋯" para ações secundárias (como Linear, GitHub e Stripe): a ação
 * principal fica visível e o resto aparece sob demanda.
 *
 * Usa a Popover API: o menu sai do contêiner (colunas e tabelas com rolagem
 * não o cortam), fecha com Esc ou clique fora e volta o foco ao botão.
 * Setas ↑ ↓ percorrem os itens.
 */
export function MoreMenu({ label, items, className }: { label: string; items: MoreMenuItem[]; className?: string }) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  if (items.length === 0) return null;

  const place = () => {
    const b = button.current?.getBoundingClientRect();
    const m = menu.current;
    if (!b || !m) return;
    const width = m.offsetWidth || 240;
    const height = m.offsetHeight || 200;
    const left = Math.max(8, Math.min(b.right - width, window.innerWidth - width - 8));
    const below = b.bottom + 6 + height <= window.innerHeight;
    m.style.left = `${left}px`;
    m.style.top = `${below ? b.bottom + 6 : Math.max(8, b.top - height - 6)}px`;
  };

  const focusItem = (dir: 1 | -1 | 0) => {
    const list = [...(menu.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not(:disabled)") ?? [])];
    if (!list.length) return;
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    list[dir === 0 ? 0 : (i + dir + list.length) % list.length].focus();
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        popoverTarget={id}
        aria-haspopup="menu"
        aria-label={label}
        title={label}
        className={cx("more-menu-trigger", className)}
      >
        <MoreHorizontal className="size-5" aria-hidden />
      </button>
      <div
        ref={menu}
        id={id}
        popover="auto"
        role="menu"
        aria-label={label}
        className="more-menu"
        onToggle={(e) => {
          if ((e as unknown as ToggleEvent).newState === "open") {
            place();
            requestAnimationFrame(() => focusItem(0));
          } else {
            button.current?.focus();
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); focusItem(1); }
          if (e.key === "ArrowUp") { e.preventDefault(); focusItem(-1); }
        }}
      >
        {items.map((it, i) => (
          <div key={`${it.label}-${i}`}>
            {it.group && <p className="more-menu-group" role="presentation">{it.group}</p>}
            <button
              type="button"
              role="menuitem"
              disabled={it.disabled}
              className={cx("more-menu-item", it.danger && "is-danger")}
              onClick={() => {
                menu.current?.hidePopover();
                it.onSelect();
              }}
            >
              {it.icon && <span className="more-menu-icon" aria-hidden>{it.icon}</span>}
              {it.label}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
