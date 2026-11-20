import { Platform, type TextStyle, type ViewStyle } from "react-native";

/**
 * Tokens do app (regras §5): os mesmos valores do site (src/app/globals.css).
 * Nenhum hex, tamanho de letra ou espaçamento fora deste arquivo.
 * A cor principal vem da oficina (settings.primaryColor); aqui fica o padrão.
 */

export const colors = {
  /** Destaque único: botões principais e seleção. Trocado pela cor da oficina. */
  primary: "#2563eb",
  primaryFg: "#ffffff",
  primarySoft: "#eaf0fd",
  /** Cor secundária da oficina: faixas escuras (crachá, avatar). */
  secondary: "#172033",
  secondaryFg: "#ffffff",

  background: "#f2f4f7",
  surface: "#ffffff",
  /** Uma família de cinzas (frios). */
  text: "#172033",
  muted: "#536379",
  border: "#dee5ed",
  hairline: "rgba(23, 32, 51, 0.07)",
  track: "#e3e7ee",

  success: "#147a3a",
  successSoft: "#e8f5ec",
  warning: "#b45309",
  warningSoft: "#fdf3e1",
  danger: "#b91c1c",
  dangerSoft: "#fdecec",
} as const;

/** Cores de etapa fixas (decisão 59): nunca dependem da cor da oficina. */
export const stageColors = {
  waiting: "#b45309",
  in_progress: "#2563eb",
  done: "#15803d",
} as const;

/** Escala de 4 em 4. */
export const space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32 } as const;

/** Formas travadas (regras §5): ações em pílula, cartões 20, campos e folhas 14. */
export const radius = { field: 14, card: 20, sheet: 22, pill: 999 } as const;

/** Toque mínimo (regras §8). */
export const touch = { min: 48 } as const;

const mono = Platform.select({ ios: "Menlo", android: "monospace", default: "ui-monospace, Menlo, monospace" });

/** Corpo 16, apoio 14 (mín. 13), títulos 20/24/28. A fonte do sistema escala sozinha. */
export const type = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: "800", color: colors.text },
  heading: { fontSize: 24, lineHeight: 30, fontWeight: "800", color: colors.text },
  section: { fontSize: 20, lineHeight: 26, fontWeight: "700", color: colors.text },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: "700", color: colors.text },
  body: { fontSize: 16, lineHeight: 22, fontWeight: "400", color: colors.text },
  label: { fontSize: 15, lineHeight: 20, fontWeight: "600", color: colors.text },
  caption: { fontSize: 14, lineHeight: 19, fontWeight: "500", color: colors.muted },
  small: { fontSize: 13, lineHeight: 17, fontWeight: "600", color: colors.muted },
  number: { fontSize: 28, lineHeight: 32, fontWeight: "800", fontVariant: ["tabular-nums"] },
  plate: { fontFamily: mono, fontWeight: "800", letterSpacing: 1.5, color: "#111827" },
} satisfies Record<string, TextStyle>;

/** Sombras leves com deslocamento (nada de brilho sem deslocamento). */
export const shadow = {
  card: Platform.select<ViewStyle>({
    ios: { shadowColor: "#172033", shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
    android: { elevation: 2 },
    default: { boxShadow: "0 4px 18px rgba(23, 32, 51, 0.06)" } as ViewStyle,
  })!,
  raised: Platform.select<ViewStyle>({
    ios: { shadowColor: "#172033", shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
    android: { elevation: 4 },
    default: { boxShadow: "0 1px 2px rgba(23,32,51,0.08), 0 4px 14px rgba(23,32,51,0.09)" } as ViewStyle,
  })!,
};

/** Movimento curto (regras §7). */
export const motion = { fast: 160, base: 240, slow: 380 } as const;
