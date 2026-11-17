"use client";

import { Lightbulb } from "lucide-react";
import type { ReactNode } from "react";
import { useApp } from "@/app-state/app-context";
import { usePref } from "@/lib/prefs";
import { Button } from "./primitives";

/**
 * Dica que aparece só até a pessoa clicar em "Entendi" (por usuário e oficina,
 * neste navegador). Explica o caminho principal e apresenta os atalhos
 * (arrastar, seleção, bandeja) como opcionais. Referência: Impeccable onboard.
 */
export function FirstTip({ id, title, children, className }: { id: string; title: string; children: ReactNode; className?: string }) {
  const { user, membership } = useApp();
  const [seen, setSeen] = usePref<boolean>(`tip:${id}:${membership.workshopId}:${user.id}`, false);
  if (seen) return null;
  return (
    <aside className={`first-tip ${className ?? ""}`} aria-label={title}>
      <Lightbulb className="first-tip-icon" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="first-tip-title">{title}</p>
        <div className="first-tip-body">{children}</div>
      </div>
      <Button size="sm" onClick={() => setSeen(true)}>Entendi</Button>
    </aside>
  );
}
