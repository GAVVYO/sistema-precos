import * as Haptics from "expo-haptics";
import { Backspace } from "phosphor-react-native";
import { useEffect } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { PressScale } from "@/components/press-scale";
import { colors, space } from "@/theme";

const haptic = (fn: () => Promise<void>) => { if (Platform.OS !== "web") fn(); };

/**
 * Bolinhas + teclado do PIN (decisões 70 e 76). Cada número faz a bolinha
 * "pular"; erro balança a fileira; acerto pinta as 4 de verde, uma depois da outra.
 */
export function PinPad({ pin, onChange, onComplete, errors, ok, disabled, message }: {
  pin: string;
  onChange: (pin: string) => void;
  onComplete: (pin: string) => void;
  /** Muda a cada erro: dispara o balanço. */
  errors: number;
  ok: boolean;
  disabled: boolean;
  message: string;
}) {
  const reduced = useReducedMotion();
  const shakeX = useSharedValue(0);
  const shake = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.get() }] }));

  useEffect(() => {
    if (!errors) return;
    haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
    if (!reduced) shakeX.set(withSequence(withTiming(-10, { duration: 50 }), withTiming(10, { duration: 70 }), withTiming(-8, { duration: 70 }), withTiming(6, { duration: 60 }), withTiming(0, { duration: 50 })));
  }, [errors, reduced, shakeX]);

  const press = (d: string) => {
    if (disabled || ok || pin.length >= 4) return;
    haptic(() => Haptics.selectionAsync());
    const next = pin + d;
    onChange(next);
    if (next.length === 4) setTimeout(() => onComplete(next), 120);
  };

  return (
    <View style={styles.box}>
      <Animated.View style={[styles.dots, shake]} role="img" accessibilityLabel={`${pin.length} de 4 números digitados`}>
        {[0, 1, 2, 3].map((i) => <Dot key={i} i={i} on={i < pin.length} ok={ok} reduced={reduced} />)}
      </Animated.View>
      <Text style={[styles.msg, ok && { color: colors.success }]} accessibilityLiveRegion="polite" role="alert">{message}</Text>
      <View style={styles.pad}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((k, i) =>
          k === "" ? <View key={i} style={[styles.key, styles.keyGhost]} /> : k === "del" ? (
            <Pressable key={i} accessibilityRole="button" accessibilityLabel="Apagar" disabled={!pin || ok} onPress={() => onChange(pin.slice(0, -1))} style={[styles.key, styles.keyGhost]}>
              <Backspace size={28} color={colors.muted} weight="duotone" />
            </Pressable>
          ) : (
            <PressScale key={i} scale={0.92} accessibilityRole="button" accessibilityLabel={k} disabled={disabled || ok} onPress={() => press(k)} style={[styles.key, disabled || ok ? styles.keyOff : null]}>
              <Text style={styles.keyText}>{k}</Text>
            </PressScale>
          ),
        )}
      </View>
    </View>
  );
}

function Dot({ i, on, ok, reduced }: { i: number; on: boolean; ok: boolean; reduced: boolean }) {
  const s = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    if (ok) s.set(withDelay(i * 70, withSequence(withTiming(1.35, { duration: 130 }), withSpring(1, { damping: 9, stiffness: 260 }))));
    else if (on) s.set(withSequence(withTiming(1.25, { duration: 90 }), withSpring(1, { damping: 10, stiffness: 300 })));
  }, [i, on, ok, reduced, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));
  return <Animated.View style={[styles.dot, on && styles.dotOn, ok && styles.dotOk, style]} />;
}

const KEY = 74;
const styles = StyleSheet.create({
  box: { alignItems: "center", gap: space.sm },
  dots: { flexDirection: "row", gap: 18, paddingVertical: 6 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "#9aa6b6" },
  dotOn: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  dotOk: { backgroundColor: colors.success, borderColor: colors.success },
  msg: { minHeight: 20, fontSize: 15, fontWeight: "700", color: colors.danger, textAlign: "center" },
  pad: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", width: KEY * 3 + 22 * 2, columnGap: 22, rowGap: 12 },
  key: { width: KEY, height: KEY, borderRadius: KEY / 2, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  keyOff: { opacity: 0.4 },
  keyGhost: { backgroundColor: "transparent" },
  keyText: { fontSize: 30, fontWeight: "600", color: colors.text, fontVariant: ["tabular-nums"] },
});
