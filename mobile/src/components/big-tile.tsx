import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow, space } from "@/theme";

/** Botão gigante da tela inicial (estilo caixa eletrônico): ícone, uma palavra e, se houver, um número. */
export function BigTile({ label, icon, count, onPress, filled, hint }: { label: string; icon: (color: string) => ReactNode; count?: number; onPress: () => void; filled?: boolean; hint?: string }) {
  const fg = filled ? colors.primaryFg : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count !== undefined ? `${label}: ${count}` : label}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, filled && styles.filled, pressed && styles.pressed]}
    >
      <View style={[styles.iconWell, filled && styles.iconWellFilled]}>{icon(filled ? colors.primaryFg : colors.primary)}</View>
      <View style={styles.bottom}>
        <Text style={[styles.label, { color: fg }]} numberOfLines={2}>{label}</Text>
        {count !== undefined && <Text style={[styles.count, { color: filled ? colors.primaryFg : colors.primary }]}>{count}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, aspectRatio: 0.92, justifyContent: "space-between", padding: space.lg, borderRadius: radius.card + 4, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, ...shadow.card },
  filled: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.92 },
  iconWell: { width: 60, height: 60, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  iconWellFilled: { backgroundColor: "rgba(255,255,255,0.18)" },
  bottom: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space.xs },
  label: { flex: 1, fontSize: 20, lineHeight: 24, fontWeight: "800" },
  count: { fontSize: 34, lineHeight: 36, fontWeight: "800", fontVariant: ["tabular-nums"] },
});
