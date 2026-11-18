import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, space } from "@/theme";

/** Etiqueta cinza (nº do serviço, mecânico, há quanto tempo). `dot` mostra a cor da etapa. */
export function Chip({ label, dot, icon, tone = "neutral" }: { label: string; dot?: string; icon?: ReactNode; tone?: "neutral" | "primary" }) {
  return (
    <View style={[styles.chip, tone === "primary" && styles.primary]}>
      {dot && <View style={[styles.dot, { backgroundColor: dot }]} />}
      {icon}
      <Text style={[styles.text, tone === "primary" && { color: colors.primary }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 28, paddingHorizontal: space.sm, borderRadius: radius.pill, backgroundColor: colors.background, alignSelf: "flex-start" },
  primary: { backgroundColor: colors.primarySoft },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontSize: 13, fontWeight: "600", color: colors.text },
});
