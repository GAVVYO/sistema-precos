import { router } from "expo-router";
import { Camera, CheckCircle, CurrencyCircleDollar, Play } from "phosphor-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ServiceOrder } from "@core/domain/types";
import { formatBRL } from "@core/lib/format";
import { canChangeStatus, orderTotals, paymentSituation } from "@core/services/orders";
import { PHOTO_STAGE_LABEL, photosOf, stageForStatus } from "@core/services/photos";
import { moveOrder } from "@/data/actions";
import { capturePhoto } from "@/data/photos";
import { PillButton } from "@/components/pill-button";
import { Plate } from "@/components/plate";
import { sinceShop, vehicleLabel } from "@/data/helpers";
import { useApp } from "@/data/store";
import { colors, radius, shadow, space } from "@/theme";

/**
 * Cartão de carro enxuto (19/11: "muito poluído"): placa, nome do cliente,
 * o que fazer e UM botão grande. Tocar no resto abre a ficha.
 */
export function CarCard({ order }: { order: ServiceOrder }) {
  const { db, view, user, membership, can, customerOf, vehicleOf, userOf } = useApp();
  const mechanic = membership.role === "mechanic";
  const who = order.mechanicId && !mechanic ? userOf(order.mechanicId)?.name.split(" ")[0] : undefined;
  const v = vehicleOf(order.vehicleId);
  const customer = customerOf(order.customerId)?.name.split(" ").slice(0, 2).join(" ") ?? "Cliente";
  const totals = orderTotals(view, order);
  const owes = order.status === "done" && paymentSituation(order, totals) === "pending" && can("finance.payment");
  const photos = photosOf(view, order.id).length;
  const next = order.status === "waiting" ? "in_progress" : order.status === "in_progress" ? "done" : null;
  const canNext = next && canChangeStatus(db, { workshopId: order.workshopId, userId: user.id }, order.status, next);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
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
          <Text style={styles.meta} numberOfLines={1}>{[vehicleLabel(v), who && `com ${who}`, sinceShop(order.openedAt)].filter(Boolean).join(" · ")}</Text>
        </View>
      </Pressable>
        {/* Atalho: foto do carro na etapa atual, sem abrir a ficha (decisão 87). */}
      <Pressable
        onPress={() => capturePhoto(order.id, stageForStatus(order.status))}
        accessibilityRole="button"
        accessibilityLabel={`Tirar foto do carro (${PHOTO_STAGE_LABEL[stageForStatus(order.status)]})${photos ? `, ${photos} já salvas` : ""}`}
        hitSlop={6}
        style={({ pressed }) => [styles.cam, pressed && styles.pressed]}
      >
        <Camera size={24} color={colors.primary} weight="bold" />
        {photos > 0 && <View style={styles.camBadge}><Text style={styles.camBadgeText}>{photos}</Text></View>}
      </Pressable>
      </View>
      {owes ? (
        <PillButton full label={`Receber ${formatBRL(totals.totalCents)}`} icon={<CurrencyCircleDollar size={22} color={colors.primaryFg} weight="duotone" />} onPress={() => router.push({ pathname: "/receber/[id]", params: { id: order.id } })} />
      ) : canNext ? (
        <PillButton
          full
          haptic
          label={next === "done" ? (mechanic ? "Ficou pronto" : "Marcar como pronto") : mechanic ? "Comecei" : "Começar"}
          icon={next === "done" ? <CheckCircle size={22} color={colors.primaryFg} weight="duotone" /> : <Play size={18} color={colors.primaryFg} weight="fill" />}
          onPress={() => moveOrder(db, user.id, order, next, customer.split(" ")[0])}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md, padding: space.md, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, ...shadow.card },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  open: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.md },
  pressed: { opacity: 0.8 },
  main: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 18, fontWeight: "800", color: colors.text },
  what: { fontSize: 16, color: colors.text },
  cam: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  camBadge: { position: "absolute", top: -2, right: -2, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  camBadgeText: { fontSize: 12, fontWeight: "800", color: colors.primaryFg },
  meta: { fontSize: 14, color: colors.muted },
});
