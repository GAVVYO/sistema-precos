"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Preferências de interface (layout do painel, colunas de tabela…), salvas no
 * navegador por usuário e oficina. Não são dados de negócio: se o
 * armazenamento falhar, a tela volta ao padrão sem quebrar.
 */
const PREFIX = "gavyo:prefs:";

export function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writePref<T>(key: string, value: T | undefined): void {
  try {
    if (value === undefined) window.localStorage.removeItem(PREFIX + key);
    else window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* armazenamento indisponível: preferência vale só nesta sessão */
  }
}

/** Estado React persistido em preferência. `reset()` volta ao padrão. */
export function usePref<T>(key: string, fallback: T): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [value, setValue] = useState<T>(() => (typeof window === "undefined" ? fallback : readPref(key, fallback)));

  // Troca de usuário/oficina muda a chave: recarrega a preferência correspondente.
  const [loadedKey, setLoadedKey] = useState(key);
  if (loadedKey !== key) {
    setLoadedKey(key);
    setValue(readPref(key, fallback));
  }

  useEffect(() => {
    writePref(key, value);
  }, [key, value]);

  const reset = useCallback(() => {
    writePref(key, undefined);
    setValue(fallback);
    // fallback é estável por chamada (constante do módulo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [value, setValue, reset];
}

/** Rótulo do modificador de atalho conforme o sistema: ⌘ no Mac, Ctrl nos demais. */
export function modKey(): string {
  if (typeof navigator === "undefined") return "Ctrl";
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl";
}
