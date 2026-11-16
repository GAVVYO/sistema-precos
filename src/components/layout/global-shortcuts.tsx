"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "@/app-state/app-context";
import { runUndo } from "@/components/ui/toast";
import { useVisibleModules } from "./app-shell";

/** Letra usada depois de "G" para abrir cada módulo (como no Gmail e no Linear). */
export const GO_KEYS: Record<string, string> = {
  "/inicio": "I",
  "/ordens": "O",
  "/estoque": "E",
  "/financeiro": "F",
  "/agenda": "A",
  "/clientes": "C",
  "/relatorios": "R",
  "/configuracoes": "S",
};

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

/** Atalhos de uma tecla não agem por trás de um modal aberto. */
function modalOpen(): boolean {
  return document.querySelector("dialog[open]") !== null;
}

/**
 * Atalhos globais (Ctrl/⌘+K fica na busca do cabeçalho):
 * N nova OS · G + letra abre um módulo · Ctrl/⌘+Z desfaz a última movimentação.
 * Não agem dentro de campos de texto nem com modal aberto.
 */
export function GlobalShortcuts() {
  const router = useRouter();
  const { can, online, settings, openNewOrder } = useApp();
  const modules = useVisibleModules();

  useEffect(() => {
    let goAt = 0;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || modalOpen()) return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "z") {
        if (runUndo()) e.preventDefault();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toUpperCase();
      if (Date.now() - goAt < 1200) {
        goAt = 0;
        const target = modules.find((m) => GO_KEYS[m.href] === key);
        if (target) {
          e.preventDefault();
          router.push(target.href);
        }
        return;
      }
      if (key === "G") {
        goAt = Date.now();
        return;
      }
      if (key === "N" && online && can("os.create") && settings.activeModules.includes("orders")) {
        e.preventDefault();
        openNewOrder();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modules, router, can, online, settings.activeModules, openNewOrder]);

  return null;
}
