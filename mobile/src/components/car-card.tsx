import { router } from "expo-router";
import { CheckCircle, CurrencyCircleDollar, Play } from "phosphor-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ServiceOrder } from "@core/domain/types";
import { formatBRL, formatOrderNumber } from "@core/lib/format";
import { canChangeStatus, changeOrderStatus, orderTotals, paymentSituation } from "@core/services/orders";
import { Chip } from "@/components/chip";
import { PillButton } from "@/components/pill-button";
import { Plate } from "@/components/plate";
import { sinceShop, vehicleLabel } from "@/data/helpers";
import { act, useApp } from "@/data/store";
import { colors, radius, shadow, space, stageColors, type } from "@/theme";

/**
 * Cartão de carro (o mesmo do pátio e de Serviços do site): placa desenhada,
 * carro · cliente, serviço, etiquetas e UM botão (Começar / Marcar como pronto / Receber).
 * Tocar no cartão abre a ficha.
 */
export function CarCard({ order, hideMoney, hideMechanic }: { order: ServiceOrder; hideMoney?: boolean; hideMechanic?: boolean }) {
  const { db, view, user, can, customerOf, vehicleOf, userOf } = useApp();
  const v = vehicleOf(order.vehicleId);
  const customer = customerOf(order.customerId)?.name ?? "Cliente";
  const mech = userOf(order.mechanicId)?.name.split(" ").slice(0, 2).join(" ");
  const totals = orderTotals(view, order);
  const owes = order.status === "done" && paymentSituation(order, totals) === "pending";
  const next = order.status === "waiting" ? "in_progress" : order.status === "in_progress" ? "done" : null;
  const ctx = { workshopId: order.workshopId, userId: user.id, now: new Date() };
  const canNext = next && canChangeStatus(db, ctx, order.status, next);

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => router.push({ pathname: "/servico/[id]", params: { id: order.id } })}
        accessibilityRole="button"
        accessibilityLabel={`${vehicleLabel(v)} de ${customer}. ${order.description}. Abrir ficha.`}
        style={({ pressed }) => [styles.open, pressed && styles.pressed]}
      >
      <View style={styles.top}>
        <Plate plate={v?.plate} size="md" />
        <View style={styles.main}>
          <Text style={type.bodyStrong} numberOfLines={1}>{vehicleLabel(v)}</Text>
          <Text style={type.caption} numberOfLines={1}>{customer}</Text>
        </View>
      </View>
      <Text style={styles.what} numberOfLines={2}>{order.description}</Text>
      <View style={styles.chips}>
        <Chip label={formatOrderNumber(order.number)} dot={stageColors[order.status]} tone="primary" />
        {!hideMechanic && <Chip label={mech ?? "Ninguém pegou"} />}
        <Chip label={sinceShop(order.openedAt)} />
      </View>
      </Pressable>
      {(owes || canNext || !hideMoney) && (
        <View style={styles.bottom}>
          {!hideMoney && <Text style={styles.value}>{totals.laborPending ? "A definir" : formatBRL(totals.totalCents)}</Text>}
          {owes && can("finance.payment") ? (
            <PillButton label="Receber" icon={<CurrencyCircleDollar size={20} color={colors.primaryFg} weight="duotone" />} onPress={() => router.push({ pathname: "/receber/[id]", params: { id: order.id } })} />
          ) : canNext ? (
            <PillButton
              label={next === "done" ? "Marcar como pronto" : "Começar"}
              icon={next === "done" ? <CheckCircle size={20} color={colors.primaryFg} weight="duotone" /> : <Play size={16} color={colors.primaryFg} weight="fill" />}
              haptic
              onPress={() => act((d, c) => changeOrderStatus(d, c, order.id, next))}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm, padding: space.md, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, ...shadow.card },
  open: { gap: space.sm, borderRadius: radius.field },
  pressed: { opacity: 0.85 },
  top: { flexDirection: "row", alignItems: "center", gap: space.sm },
  main: { flex: 1, minWidth: 0 },
  what: { fontSize: 16, lineHeight: 22, color: colors.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  bottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colors.hairline },
  value: { fontSize: 18, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] },
});
