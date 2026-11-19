import { router } from "expo-router";
import { CheckCircle, CurrencyCircleDollar, Play } from "phosphor-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ServiceOrder } from "@core/domain/types";
import { formatBRL } from "@core/lib/format";
import { canChangeStatus, changeOrderStatus, orderTotals, paymentSituation } from "@core/services/orders";
import { PillButton } from "@/components/pill-button";
import { Plate } from "@/components/plate";
import { act, useApp } from "@/data/store";
import { colors, radius, shadow, space } from "@/theme";

/**
 * Cartão de carro enxuto (19/11: "muito poluído"): placa, nome do cliente,
 * o que fazer e UM botão grande. Tocar no resto abre a ficha.
 */
export function CarCard({ order }: { order: ServiceOrder }) {
  const { db, view, user, can, customerOf, vehicleOf } = useApp();
  const v = vehicleOf(order.vehicleId);
  const customer = customerOf(order.customerId)?.name.split(" ").slice(0, 2).join(" ") ?? "Cliente";
  const totals = orderTotals(view, order);
  const owes = order.status === "done" && paymentSituation(order, totals) === "pending" && can("finance.payment");
  const next = order.status === "waiting" ? "in_progress" : order.status === "in_progress" ? "done" : null;
  const canNext = next && canChangeStatus(db, { workshopId: order.workshopId, userId: user.id }, order.status, next);

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => router.push({ pathname: "/servico/[id]", params: { id: order.id } })}
        accessibilityRole="button"
        accessibilityLabel={`${customer}. ${order.description}. Abrir ficha.`}
        style={({ pressed }) => [styles.open, pressed && styles.pressed]}
      >
        <Plate plate={v?.plate} size="md" />
        <View style={styles.main}>
          <Text style={styles.name} numberOfLines={1}>{customer}</Text>
          <Text style={styles.what} numberOfLines={1}>{order.description}</Text>
        </View>
      </Pressable>
      {owes ? (
        <PillButton full label={`Receber ${formatBRL(totals.totalCents)}`} icon={<CurrencyCircleDollar size={22} color={colors.primaryFg} weight="duotone" />} onPress={() => router.push({ pathname: "/receber/[id]", params: { id: order.id } })} />
      ) : canNext ? (
        <PillButton
          full
          haptic
          label={next === "done" ? "Pronto" : "Começar"}
          icon={next === "done" ? <CheckCircle size={22} color={colors.primaryFg} weight="duotone" /> : <Play size={18} color={colors.primaryFg} weight="fill" />}
          onPress={() => act((d, c) => changeOrderStatus(d, c, order.id, next))}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md, padding: space.md, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, ...shadow.card },
  open: { flexDirection: "row", alignItems: "center", gap: space.md },
  pressed: { opacity: 0.8 },
  main: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 18, fontWeight: "800", color: colors.text },
  what: { fontSize: 16, color: colors.muted },
});
