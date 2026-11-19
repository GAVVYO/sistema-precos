import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { PressScale } from "@/components/press-scale";
import { colors, radius, space, touch } from "@/theme";

type Variant = "primary" | "secondary" | "ghost" | "danger";

/**
 * Botão em pílula (regras §5). Um principal por tela/cartão.
 * `haptic`: vibração leve ao tocar (só em ações que mudam algo — regras §7).
 */
export function PillButton({ label, onPress, variant = "primary", icon, disabled, loading, haptic, full, accessibilityHint }: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  haptic?: boolean;
  full?: boolean;
  accessibilityHint?: string;
}) {
  const v = VARIANTS[variant];
  const off = disabled || loading;
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={() => {
        if (haptic && Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      containerStyle={full ? styles.full : styles.hug}
      style={[styles.base, { backgroundColor: v.bg, borderColor: v.border }, off && styles.off]}
      pressedStyle={styles.pressed}
    >
      <View style={styles.row}>
        {loading ? <ActivityIndicator color={v.fg} /> : icon}
        <Text style={[styles.label, { color: v.fg }]} numberOfLines={1}>{label}</Text>
      </View>
    </PressScale>
  );
}

const VARIANTS: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: colors.primaryFg, border: colors.primary },
  secondary: { bg: colors.surface, fg: colors.text, border: colors.border },
  ghost: { bg: "transparent", fg: colors.primary, border: "transparent" },
  danger: { bg: colors.surface, fg: colors.danger, border: colors.dangerSoft },
};

const styles = StyleSheet.create({
  base: { minHeight: touch.min, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, justifyContent: "center" },
  full: { alignSelf: "stretch" },
  hug: { alignSelf: "flex-start" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.xs },
  label: { fontSize: 16, fontWeight: "700" },
  pressed: { opacity: 0.92 },
  off: { opacity: 0.45 },
});
