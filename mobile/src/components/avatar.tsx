import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

/** Tons calmos para as iniciais (mesma lista e mesma conta do site: a pessoa tem sempre a mesma cor). */
const TONES = ["#2563eb", "#0f766e", "#b45309", "#7c3aed", "#be123c", "#0369a1", "#4d7c0f", "#a16207"];

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function toneOf(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

/** Escurece a cor (mistura com preto) para o texto das iniciais passar no contraste 4,5:1. */
function darken(hex: string, amount = 0.32): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * (1 - amount)).toString(16).padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

/** Foto ou iniciais. Decorativo: o nome sempre aparece ao lado. */
export function Avatar({ name, photo, size = 44 }: { name: string; photo?: string | null; size?: number }) {
  const tone = toneOf(name || "?");
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.box, { width: size, height: size, borderRadius: size / 2, backgroundColor: tone + "1f" }]}
    >
      {photo ? (
        <Image source={{ uri: photo }} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <Text style={{ color: darken(tone), fontSize: size * 0.38, fontWeight: "800" }}>{initialsOf(name)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({ box: { alignItems: "center", justifyContent: "center", overflow: "hidden" } });
