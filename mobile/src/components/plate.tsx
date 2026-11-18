import { StyleSheet, Text, View } from "react-native";
import { formatPlate } from "@core/lib/format";
import { colors, type } from "@/theme";

/**
 * Placa desenhada (âncora visual do produto, igual ao site): faixa azul "BRASIL"
 * + placa em mono. O leitor de tela ouve "Placa A B C 1 D 2 3".
 */
export function Plate({ plate, size = "md" }: { plate?: string; size?: "sm" | "md" | "lg" }) {
  const s = SIZES[size];
  const text = plate ? formatPlate(plate) : "———";
  return (
    <View
      accessible
      accessibilityLabel={plate ? `Placa ${text.replace(/-/g, "").split("").join(" ")}` : "Sem placa"}
      style={[styles.plate, { width: s.width }]}
    >
      <View style={[styles.band, { height: s.band }]}>
        <Text style={[styles.bandText, { fontSize: s.band * 0.62 }]}>BRASIL</Text>
      </View>
      <Text style={[type.plate, styles.text, { fontSize: s.font, paddingVertical: s.pad }]} numberOfLines={1} adjustsFontSizeToFit>{text}</Text>
    </View>
  );
}

const SIZES = {
  sm: { width: 88, band: 10, font: 14, pad: 2 },
  md: { width: 108, band: 12, font: 17, pad: 3 },
  lg: { width: 220, band: 22, font: 36, pad: 8 },
};

const styles = StyleSheet.create({
  plate: { borderWidth: 2, borderColor: "#1f2937", borderRadius: 7, backgroundColor: colors.surface, overflow: "hidden" },
  band: { backgroundColor: "#1d4ed8", alignItems: "center", justifyContent: "center" },
  bandText: { color: "#fff", fontWeight: "800", letterSpacing: 3 },
  text: { textAlign: "center" },
});
