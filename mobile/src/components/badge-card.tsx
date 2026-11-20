import { Camera, Check } from "phosphor-react-native";
import { useEffect } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { Easing, Keyframe, ReduceMotion, useReducedMotion } from "react-native-reanimated";
import Svg, { Defs, Ellipse, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { formatPhone, todayISO, formatDate } from "@core/lib/format";
import { initialsOf } from "@/components/avatar";
import { Plate } from "@/components/plate";
import { colors, radius, shadow, space } from "@/theme";

/**
 * Crachá que se preenche enquanto a pessoa digita e recebe o carimbo
 * "Cadastro concluído" (decisões 62–63 do site), versão nativa.
 * Só ilustração: os dados de verdade estão nos campos (oculto ao leitor de tela).
 */
export function BadgeCard({ name, phone, plate, workshop, stamped }: { name: string; phone: string; plate?: string; workshop: string; stamped?: boolean }) {
  const digits = phone.replace(/\D/g, "");
  return (
    <View style={styles.scene} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={styles.strap} />
      <View style={styles.card}>
        <View style={styles.band}>
          <View style={styles.slot} />
          <Text style={styles.shop} numberOfLines={1}>{workshop}</Text>
        </View>
        <View style={styles.photo}>
          {name.trim() ? <Text style={styles.initials}>{initialsOf(name)}</Text> : <Camera size={32} color={colors.muted} weight="duotone" />}
        </View>
        <Text style={[styles.name, !name.trim() && styles.placeholder]} numberOfLines={2}>{name.trim() || "Nome aparece aqui"}</Text>
        <View style={styles.role}><Text style={styles.roleText}>Cliente</Text></View>
        <Text style={[styles.line, digits.length < 10 && styles.placeholder]}>{digits.length >= 10 ? formatPhone(digits) : "(00) 00000-0000"}</Text>
        <View style={styles.plate}>{plate ? <Plate plate={plate} size="sm" /> : <Text style={styles.noPlate}>Sem carro ainda</Text>}</View>
        <Text style={styles.foot}>Cliente desde {formatDate(todayISO())}</Text>
        {stamped && <Stamp />}
      </View>
    </View>
  );
}

/* ---------- Carimbo ---------- */

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const DOWN = Easing.bezier(0.55, 0, 0.85, 0.45); // acelera até bater (único trecho)
const STAMPER = new Keyframe({
  0: { opacity: 0, transform: [{ translateX: 60 }, { translateY: -240 }, { rotate: "14deg" }, { scaleY: 1 }] },
  8: { opacity: 1, transform: [{ translateX: 52 }, { translateY: -214 }, { rotate: "11deg" }, { scaleY: 1 }], easing: DOWN },
  36: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: "-10deg" }, { scaleY: 1 }], easing: DOWN },
  42: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 3 }, { rotate: "-10deg" }, { scaleY: 0.92 }], easing: EASE_OUT },
  52: { opacity: 1, transform: [{ translateX: 0 }, { translateY: -6 }, { rotate: "-10deg" }, { scaleY: 1 }], easing: EASE_OUT },
  86: { opacity: 1, transform: [{ translateX: 40 }, { translateY: -200 }, { rotate: "10deg" }, { scaleY: 1 }] },
  100: { opacity: 0, transform: [{ translateX: 60 }, { translateY: -260 }, { rotate: "14deg" }, { scaleY: 1 }] },
}).duration(900);
const MARK = new Keyframe({
  0: { opacity: 0, transform: [{ rotate: "-10deg" }, { scale: 1.04 }] },
  35: { opacity: 0, transform: [{ rotate: "-10deg" }, { scale: 1.04 }] },
  38: { opacity: 1, transform: [{ rotate: "-10deg" }, { scale: 1 }] },
  100: { opacity: 1, transform: [{ rotate: "-10deg" }, { scale: 1 }] },
}).duration(900).reduceMotion(ReduceMotion.Never);

function Stamp() {
  const reduced = useReducedMotion();
  // Vibração no instante do toque (~0,33 s), junto com a marca.
  useEffect(() => {
    if (Platform.OS === "web") return;
    const t = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), reduced ? 0 : 330);
    return () => clearTimeout(t);
  }, [reduced]);
  return (
    <View style={styles.stampLayer} pointerEvents="none">
      <Animated.View entering={reduced ? undefined : MARK} style={[styles.mark, reduced && { transform: [{ rotate: "-10deg" }] }]}>
        <View style={styles.markIcon}><Check size={16} color="#fff" weight="bold" /></View>
        <Text style={styles.markText}>CADASTRO{"\n"}CONCLUÍDO</Text>
      </Animated.View>
      {!reduced && (
        <Animated.View entering={STAMPER} style={styles.stamper}>
          <Svg width={170} height={170} viewBox="0 0 200 200">
            <Defs>
              <LinearGradient id="k" x1="0" x2="1"><Stop offset="0" stopColor="#1f2430" /><Stop offset=".45" stopColor="#4b5262" /><Stop offset="1" stopColor="#1a1e27" /></LinearGradient>
              <LinearGradient id="w" x1="0" x2="1"><Stop offset="0" stopColor="#7a4a22" /><Stop offset=".4" stopColor="#b07a45" /><Stop offset="1" stopColor="#6b3f1c" /></LinearGradient>
              <LinearGradient id="m" x1="0" x2="1"><Stop offset="0" stopColor="#9aa3b2" /><Stop offset=".5" stopColor="#e6eaf0" /><Stop offset="1" stopColor="#8a93a3" /></LinearGradient>
            </Defs>
            <Ellipse cx="100" cy="32" rx="36" ry="28" fill="url(#k)" />
            <Ellipse cx="89" cy="21" rx="13" ry="6" fill="#fff" opacity={0.22} />
            <Path d="M87 56h26l7 46H80z" fill="url(#k)" />
            <Path d="M24 102h152a10 10 0 0 1 10 10v50H14v-50a10 10 0 0 1 10-10z" fill="url(#w)" />
            <Rect x="8" y="162" width="184" height="14" rx="3" fill="url(#m)" />
            <Rect x="12" y="176" width="176" height="20" rx="3" fill="#14532d" />
            <Rect x="12" y="192" width="176" height="6" rx="2" fill="#16a34a" />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

const INK = "#15803d";
const styles = StyleSheet.create({
  scene: { alignItems: "center", paddingTop: 4 },
  strap: { width: 46, height: 30, marginBottom: -12, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: colors.secondary },
  card: { width: 250, alignItems: "center", paddingBottom: space.md, borderRadius: radius.sheet, backgroundColor: colors.surface, ...shadow.card },
  band: { width: "100%", alignItems: "center", paddingTop: 24, paddingBottom: 40, paddingHorizontal: space.md, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: colors.primary },
  slot: { position: "absolute", top: 10, width: 52, height: 9, borderRadius: 5, backgroundColor: "rgba(0,0,0,0.22)" },
  shop: { color: colors.primaryFg, fontSize: 14, fontWeight: "700" },
  photo: { width: 96, height: 96, marginTop: -34, borderRadius: 48, borderWidth: 5, borderColor: colors.surface, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  initials: { fontSize: 32, fontWeight: "800", color: colors.primary },
  name: { marginTop: space.sm, marginHorizontal: space.md, fontSize: 20, fontWeight: "800", color: colors.text, textAlign: "center" },
  placeholder: { color: "#b5bfcc" },
  role: { marginTop: 6, paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.background },
  roleText: { fontSize: 13, fontWeight: "700", color: colors.text },
  line: { marginTop: 6, fontSize: 16, color: colors.text, fontVariant: ["tabular-nums"] },
  plate: { marginTop: space.sm, minHeight: 34, justifyContent: "center" },
  noPlate: { fontSize: 13, color: colors.muted },
  foot: { marginTop: space.sm, fontSize: 12, color: colors.muted },
  stampLayer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "flex-end", paddingBottom: 46 },
  mark: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 4, borderColor: INK, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.75)" },
  markIcon: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: INK },
  markText: { fontSize: 16, lineHeight: 18, fontWeight: "900", letterSpacing: 1, color: INK },
  stamper: { position: "absolute", bottom: 46 - 4, transformOrigin: "50% 100%" },
});
