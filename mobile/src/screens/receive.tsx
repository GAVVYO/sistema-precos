import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Bank, CreditCard, DeviceMobile, Money, SealCheck } from "phosphor-react-native";
import { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, Keyframe, ReduceMotion, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PAYMENT_METHOD_LABELS } from "@core/domain/labels";
import type { ID, PaymentMethod } from "@core/domain/types";
import { formatBRL } from "@core/lib/format";
import { orderTotals, registerPayment } from "@core/services/orders";
import { PillButton } from "@/components/pill-button";
import { Plate } from "@/components/plate";
import { vehicleLabel } from "@/data/helpers";
import { act, useApp } from "@/data/store";
import { colors, radius, shadow, space, type } from "@/theme";
import { CSS_EASE_OUT, EASE_OUT } from "@/theme/motion";

/** O selo "carimba": cresce um pouco além e assenta (momento raro: aqui cabe o capricho). */
const SEAL = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.6 }, { rotate: "-12deg" }] },
  60: { opacity: 1, transform: [{ scale: 1.08 }, { rotate: "2deg" }], easing: EASE_OUT },
  100: { opacity: 1, transform: [{ scale: 1 }, { rotate: "0deg" }] },
}).duration(420).reduceMotion(ReduceMotion.System);
/** Onda que se espalha uma vez quando o selo bate. */
const RING = { animationName: { from: { opacity: 0.5, transform: [{ scale: 0.7 }] }, to: { opacity: 0, transform: [{ scale: 1.7 }] } }, animationDuration: "700ms", animationDelay: "220ms", animationTimingFunction: CSS_EASE_OUT } as const;
const TEXT_IN = (i: number) => FadeInDown.duration(240).delay(180 + i * 60).easing(EASE_OUT).reduceMotion(ReduceMotion.System);

const METHODS: { key: PaymentMethod; hint: string; Icon: typeof Money }[] = [
  { key: "pix", hint: "Pelo celular", Icon: DeviceMobile },
  { key: "cash", hint: "Notas e moedas", Icon: Money },
  { key: "card", hint: "Débito ou crédito", Icon: CreditCard },
  { key: "transfer", hint: "TED ou depósito", Icon: Bank },
];

/** Receber (decisão 50): escolher a forma e confirmar. Sem campos de cartão, sem QR code. */
export function Receive({ id }: { id: ID }) {
  const { view, customerOf, vehicleOf } = useApp();
  const insets = useSafeAreaInsets();
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const reduced = useReducedMotion();
  const order = view.orders.find((o) => o.id === id);
  if (!order) return null;
  const total = orderTotals(view, order).totalCents;
  const v = vehicleOf(order.vehicleId);

  const confirm = () => {
    const r = act((d, c) => registerPayment(d, c, order.id, { method }));
    if (!r.ok) return setError(r.message);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDone(true);
    setTimeout(() => router.back(), 1300);
  };

  if (done) {
    return (
      <View style={styles.done} accessibilityLiveRegion="polite">
        <View style={styles.sealWrap}>
          {!reduced && <Animated.View style={[styles.ring, RING]} />}
          <Animated.View entering={SEAL}><SealCheck size={84} color={colors.success} weight="duotone" /></Animated.View>
        </View>
        <Animated.Text entering={TEXT_IN(0)} style={type.heading}>Recebido</Animated.Text>
        <Animated.Text entering={TEXT_IN(1)} style={styles.big}>{formatBRL(total)}</Animated.Text>
        <Animated.Text entering={TEXT_IN(2)} style={type.caption}>{PAYMENT_METHOD_LABELS[method]} · já aparece no Financeiro</Animated.Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.head}>
          <Plate plate={v?.plate} size="md" />
          <Text style={type.caption}>{vehicleLabel(v)} · {customerOf(order.customerId)?.name}</Text>
          <Text style={styles.big}>{formatBRL(total)}</Text>
        </View>
        <Text style={type.section}>Como o cliente pagou?</Text>
        <View style={styles.grid} role="radiogroup">
          {METHODS.map(({ key, hint, Icon }) => {
            const on = key === method;
            return (
              <Pressable key={key} role="radio" aria-checked={on} onPress={() => setMethod(key)} style={[styles.tile, on && styles.tileOn]}>
                <Icon size={30} color={on ? colors.primary : colors.muted} weight="duotone" />
                <Text style={[type.bodyStrong, on && { color: colors.primary }]}>{PAYMENT_METHOD_LABELS[key]}</Text>
                <Text style={type.small}>{hint}</Text>
              </Pressable>
            );
          })}
        </View>
        {error ? <Text style={{ color: colors.danger, fontSize: 15 }} role="alert">{error}</Text> : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + space.sm }]}>
        <PillButton full label={`Recebi ${formatBRL(total)}`} onPress={confirm} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.md, gap: space.md, paddingBottom: 120 },
  head: { alignItems: "center", gap: space.xs, padding: space.lg, borderRadius: radius.card, backgroundColor: colors.surface, ...shadow.card },
  big: { fontSize: 40, lineHeight: 46, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tile: { width: "48%", flexGrow: 1, gap: 4, padding: space.md, minHeight: 112, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.hairline },
  tileOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: space.md, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.hairline },
  sealWrap: { width: 120, height: 120, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: colors.success, opacity: 0 },
  done: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.sm, backgroundColor: colors.background },
});
