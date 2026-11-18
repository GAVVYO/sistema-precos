import { StyleSheet, Text, View } from "react-native";
import { colors, space } from "@/theme";

/** Título de grupo com bolinha da cor e contador (como as faixas do pátio no site). */
export function SectionTitle({ title, count, color, hint }: { title: string; count?: number; color?: string; hint?: string }) {
  return (
    <View>
    <View style={styles.row} accessibilityRole="header">
      {color && <View style={[styles.dot, { backgroundColor: color, shadowColor: color }]} />}
      <Text style={styles.title}>{title}</Text>
      {count !== undefined && <View style={[styles.count, color ? { backgroundColor: color + "1f" } : null]}><Text style={[styles.countText, color ? { color } : null]}>{count}</Text></View>}
    </View>
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.xs, marginTop: space.sm },
  dot: { width: 12, height: 12, borderRadius: 6 },
  title: { flexShrink: 1, fontSize: 18, fontWeight: "800", color: colors.text },
  count: { minWidth: 26, height: 22, paddingHorizontal: 8, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: colors.track },
  countText: { fontSize: 13, fontWeight: "800", color: colors.muted },
  hint: { fontSize: 14, fontWeight: "600", color: colors.muted, marginLeft: 20, marginTop: 2 },
});
