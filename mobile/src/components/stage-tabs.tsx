import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow, space, touch } from "@/theme";

export interface StageTab<K extends string> { key: K; label: string; count: number; color: string; icon?: (color: string) => ReactNode }

/**
 * Abas de etapa no estilo do controle segmentado do iPhone (decisão 59):
 * trilho cinza, aba escolhida branca e elevada, número na cor da etapa.
 */
export function StageTabs<K extends string>({ tabs, value, onChange }: { tabs: StageTab<K>[]; value: K; onChange: (k: K) => void }) {
  return (
    <View style={styles.track} role="tablist">
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <Pressable
            key={t.key}
            role="tab"
            aria-selected={on}
            accessibilityLabel={`${t.label}, ${t.count} ${t.count === 1 ? "carro" : "carros"}`}
            onPress={() => onChange(t.key)}
            style={({ pressed }) => [styles.tab, on && styles.on, pressed && !on && styles.pressed]}
          >
            <View style={styles.countRow}>
              {t.icon?.(on ? t.color : colors.muted)}
              <Text style={[styles.count, { color: on ? t.color : colors.muted }]}>{t.count}</Text>
            </View>
            <Text style={[styles.label, on && styles.labelOn]} numberOfLines={2}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", gap: 4, padding: 4, borderRadius: radius.card, backgroundColor: colors.track },
  tab: { flex: 1, minHeight: touch.min + 24, alignItems: "center", justifyContent: "center", gap: 2, paddingHorizontal: space.xxs, borderRadius: radius.card - 4 },
  on: { backgroundColor: colors.surface, ...shadow.raised },
  pressed: { backgroundColor: "rgba(255,255,255,0.5)" },
  count: { fontSize: 26, lineHeight: 30, fontWeight: "800", fontVariant: ["tabular-nums"] },
  countRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { fontSize: 14, lineHeight: 18, fontWeight: "600", color: colors.muted, textAlign: "center" },
  labelOn: { color: colors.text, fontWeight: "700" },
});
