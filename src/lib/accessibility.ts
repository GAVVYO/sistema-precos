export interface AccessibilityPreferences {
  textSize: "default" | "large" | "larger";
  contrast: boolean;
  spacing: boolean;
  motion: "system" | "reduce";
  reading: boolean;
}

export const DEFAULT_ACCESSIBILITY: AccessibilityPreferences = {
  textSize: "default", contrast: false, spacing: false, motion: "system", reading: false,
};

/** Preferências locais não são dados confiáveis: descarta valores desconhecidos. */
export function parseAccessibility(raw: string): AccessibilityPreferences {
  try {
    const p: unknown = JSON.parse(raw);
    if (!p || typeof p !== "object") return { ...DEFAULT_ACCESSIBILITY };
    const value = p as Record<string, unknown>;
    return {
      textSize: value.textSize === "large" || value.textSize === "larger" ? value.textSize : "default",
      contrast: value.contrast === true,
      spacing: value.spacing === true,
      motion: value.motion === "reduce" ? "reduce" : "system",
      reading: value.reading === true,
    };
  } catch {
    return { ...DEFAULT_ACCESSIBILITY };
  }
}

export function accessibilityKey(workshopId: string, userId: string) {
  return `gavyo:accessibility:v1:${workshopId}:${userId}`;
}
