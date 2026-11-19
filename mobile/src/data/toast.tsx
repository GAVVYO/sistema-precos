import { useEffect, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, space } from "@/theme";
import { toastIn, toastOut } from "@/theme/motion";

/** Aviso curto embaixo ("Foi para Em andamento"), com Desfazer opcional. Um por vez. */
interface ToastData { id: number; text: string; undo?: () => void }
let current: ToastData | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showToast(text: string, undo?: () => void) {
  current = { id: ++seq, text, undo };
  emit();
}
const hide = (id: number) => { if (current?.id === id) { current = null; emit(); } };

export function ToastHost() {
  const t = useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => current, () => current);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!t) return;
    const timer = setTimeout(() => hide(t.id), t.undo ? 5000 : 3000);
    return () => clearTimeout(timer);
  }, [t]);
  if (!t) return null;
  return (
    <Animated.View key={t.id} entering={toastIn} exiting={toastOut} style={[styles.toast, { bottom: insets.bottom + 88 }]} accessibilityLiveRegion="polite" role="status">
      <Text style={styles.text}>{t.text}</Text>
      {t.undo && (
        <Pressable accessibilityRole="button" hitSlop={12} onPress={() => { t.undo?.(); hide(t.id); }} style={styles.undo}>
          <Text style={styles.undoText}>Desfazer</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: { position: "absolute", left: space.md, right: space.md, flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 56, paddingLeft: space.lg, paddingRight: space.xs, borderRadius: radius.card, backgroundColor: colors.secondary },
  text: { flex: 1, fontSize: 16, fontWeight: "600", color: colors.secondaryFg },
  undo: { minHeight: 44, justifyContent: "center", paddingHorizontal: space.md, borderRadius: radius.pill },
  undoText: { fontSize: 16, fontWeight: "800", color: "#9cc3ff" },
});
