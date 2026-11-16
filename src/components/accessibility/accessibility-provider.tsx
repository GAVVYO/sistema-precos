"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useApp } from "@/app-state/app-context";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { accessibilityKey, AccessibilityPreferences, DEFAULT_ACCESSIBILITY, parseAccessibility } from "@/lib/accessibility";

const EVENT = "gavyo-accessibility";
const temporary = new Map<string, string>();
const subscribe = (notify: () => void) => {
  window.addEventListener(EVENT, notify);
  window.addEventListener("storage", notify);
  return () => { window.removeEventListener(EVENT, notify); window.removeEventListener("storage", notify); };
};

interface AccessibilityValue {
  preferences: AccessibilityPreferences;
  update: (changes: Partial<AccessibilityPreferences>) => void;
  reset: () => void;
  read: (label: string, text: string) => void;
}
const Context = createContext<AccessibilityValue | null>(null);

export function useAccessibility() {
  const value = useContext(Context);
  if (!value) throw new Error("Acessibilidade requer AccessibilityProvider.");
  return value;
}

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const { membership, user } = useApp();
  const key = accessibilityKey(membership.workshopId, user.id);
  const raw = useSyncExternalStore(subscribe, () => {
    if (temporary.has(key)) return temporary.get(key)!;
    try { return localStorage.getItem(key) ?? ""; } catch { return ""; }
  }, () => "");
  const preferences = useMemo(() => parseAccessibility(raw), [raw]);
  const [reading, setReading] = useState<{ label: string; text: string } | null>(null);

  const persist = (next: AccessibilityPreferences) => {
    const serialized = JSON.stringify(next);
    try { localStorage.setItem(key, serialized); temporary.delete(key); }
    catch {
      temporary.set(key, serialized);
      toast("error", "Ajuste aplicado nesta sessão. O navegador não permitiu salvar as preferências.");
    }
    window.dispatchEvent(new Event(EVENT));
  };

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.textSize = preferences.textSize;
    root.dataset.contrast = preferences.contrast ? "more" : "default";
    root.dataset.spacing = preferences.spacing ? "comfortable" : "default";
    root.dataset.motion = preferences.motion;
    window.dispatchEvent(new Event("gavyo-motion"));
    return () => {
      for (const name of ["textSize", "contrast", "spacing", "motion"]) delete root.dataset[name];
      window.dispatchEvent(new Event("gavyo-motion"));
    };
  }, [preferences]);

  useEffect(() => {
    if (!preferences.reading) return;
    const onKey = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.key.toLowerCase() !== "l") return;
      const selected = window.getSelection()?.toString().trim();
      if (!selected) return;
      event.preventDefault();
      setReading({ label: "Texto selecionado", text: selected.slice(0, 12000) });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [preferences.reading]);

  return <Context.Provider value={{ preferences, update: changes => persist({ ...preferences, ...changes }), reset: () => persist({ ...DEFAULT_ACCESSIBILITY }), read: (label, text) => setReading({ label, text }) }}>
    {children}
    {reading && <Dialog title="Leitura ampliada" subtitle={reading.label} onClose={() => setReading(null)} footer={<Button onClick={() => setReading(null)}>Fechar leitura</Button>}>
      <p className="reading-content" tabIndex={0} autoFocus>{reading.text}</p>
    </Dialog>}
  </Context.Provider>;
}
