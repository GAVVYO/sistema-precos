"use client";

import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";
const subscribe = (callback: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", callback);
  window.addEventListener("gavyo-motion", callback);
  return () => { media.removeEventListener("change", callback); window.removeEventListener("gavyo-motion", callback); };
};

/** Sem movimento durante SSR; respeita também mudanças na preferência do SO. */
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches || document.documentElement.dataset.motion === "reduce", () => true);
}
