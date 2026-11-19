import { router, Stack } from "expo-router";
import { Check, CheckCircle, CurrencyCircleDollar, HourglassMedium, Money, Phone, Play, SealCheck, WhatsappLogo, Wrench } from "phosphor-react-native";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ID } from "@core/domain/types";
import { formatBRL, formatBRLOrPending, formatOrderNumber, formatPhone } from "@core/lib/format";
import { canChangeStatus, orderTotals, paymentSituation } from "@core/services/orders";
import { moveOrder } from "@/data/actions";
import { statusMessage } from "@core/lib/whatsapp";
import { ORDER_STATUS_LABELS } from "@core/domain/labels";
import { Avatar } from "@/components/avatar";
import { Chip } from "@/components/chip";
import { PillButton } from "@/components/pill-button";
import { Plate } from "@/components/plate";
import { sinceShop, vehicleLabel } from "@/data/helpers";
import { useApp } from "@/data/store";
import { colors, radius, shadow, space, stageColors, type } from "@/theme";

const STEPS = [
  { key: "waiting", label: "Aguardando", Icon: HourglassMedium },
  { key: "in_progress", label: "Em andamento", Icon: Wrench },
  { key: "done", label: "Pronto", Icon: SealCheck },
  { key: "paid", label: "Pago", Icon: Money },
] as const;

/** Ficha do serviço (decisão 60) em uma coluna, com o botão principal fixo embaixo. */
export function OrderDetail({ id }: { id: ID }) {
  const { db, view, user, membership, can, customerOf, vehicleOf, userOf, partOf } = useApp();
  const insets = useSafeAreaInsets();
  const order = view.orders.find((o) => o.id === id);
  if (!order) return null;
  const v = vehicleOf(order.vehicleId);
  const customer = customerOf(order.customerId);
  const mech = userOf(order.mechanicId)?.name;
  const items = view.orderItems.filter((i) => i.orderId === order.id);
  const totals = orderTotals(view, order);
  const situation = paymentSituation(order, totals);
  const paid = situation === "paid" || situation === "free";
  const at = paid && order.status === "done" ? 3 : STEPS.findIndex((s) => s.key === order.status);
  const showMoney = membership.role !== "mechanic";
  const next = order.status === "waiting" ? "in_progress" : order.status === "in_progress" ? "done" : null;
  const ctx = { workshopId: order.workshopId, userId: user.id, now: new Date() };
  const canNext = next && canChangeStatus(db, ctx, order.status, next);
  const owes = order.status === "done" && situation === "pending" && can("finance.payment");
  const sendUpdate = () => customer && Linking.openURL(`https://wa.me/55${customer.phone}?text=${encodeURIComponent(statusMessage({ customerName: customer.name, workshopName: view.settings?.displayName ?? "", vehicle: vehicleLabel(v), plate: v?.plate ?? "", orderNumber: order.number, statusLabel: ORDER_STATUS_LABELS[order.status] }))}`);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: formatOrderNumber(order.number) }} />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.hero}>
          <View style={styles.plateWell}><Plate plate={v?.plate} size="lg" /></View>
          <Text style={[type.heading, { textAlign: "center" }]}>{vehicleLabel(v)}</Text>
          <Text style={[type.caption, { textAlign: "center" }]}>{customer?.name} · {sinceShop(order.openedAt)}</Text>
        </View>

        <View style={styles.steps} accessibilityLabel={`Etapa: ${STEPS[at].label}`}>
          {STEPS.map((s, i) => {
            const state = i < at ? "done" : i === at ? "current" : "todo";
            return (
              <View key={s.key} style={styles.step}>
                <View style={[styles.dot, state === "done" && { backgroundColor: stageColors.done }, state === "current" && { backgroundColor: colors.primary }]}>
                  {state === "done" ? <Check size={16} color="#fff" weight="bold" /> : <s.Icon size={18} color={state === "current" ? "#fff" : colors.muted} weight="duotone" />}
                </View>
                <Text style={[styles.stepLabel, state !== "todo" && { color: colors.text }]} numberOfLines={2}>{s.label}</Text>
                {i < STEPS.length - 1 && <View style={[styles.line, i < at && { backgroundColor: stageColors.done }]} />}
              </View>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={type.section}>O que fazer</Text>
          <Text style={styles.desc}>{order.description}</Text>
          <View style={styles.row}>
            <Avatar name={mech ?? "?"} size={32} />
            <Text style={type.body}>{mech ? <>Com <Text style={{ fontWeight: "700" }}>{mech.split(" ").slice(0, 2).join(" ")}</Text></> : "Ninguém pegou ainda"}</Text>
          </View>
          {order.mileage ? <Chip label={`${order.mileage.toLocaleString("pt-BR")} km`} /> : null}
          {order.notes ? <Text style={styles.notes}>{order.notes}</Text> : null}
        </View>

        <View style={styles.card}>
          <View style={styles.between}><Text style={type.section}>Peças</Text><Chip label={String(items.length)} /></View>
          {items.length === 0 && <Text style={type.caption}>Nenhuma peça lançada ainda.</Text>}
          {items.map((i) => (
            <View key={i.id} style={styles.part}>
              <View style={{ flex: 1 }}>
                <Text style={type.body}>{partOf(i.partId)?.name ?? "Peça"}</Text>
                <Text style={type.caption}>{i.quantity} {showMoney ? `× ${formatBRL(i.unitPriceCents)}` : i.quantity === 1 ? "unidade" : "unidades"}</Text>
              </View>
              {showMoney && <Text style={styles.money}>{formatBRL(i.quantity * i.unitPriceCents)}</Text>}
            </View>
          ))}
        </View>

        {showMoney && (
          <View style={styles.card}>
            <Text style={type.section}>Quanto custa</Text>
            <Text style={styles.total}>{totals.laborPending ? "A definir" : formatBRL(totals.totalCents)}</Text>
            <View style={styles.between}><Text style={type.caption}>Mão de obra</Text><Text style={type.body}>{formatBRLOrPending(totals.laborCents)}</Text></View>
            <View style={styles.between}><Text style={type.caption}>Peças</Text><Text style={type.body}>{formatBRL(totals.partsCents)}</Text></View>
            <Text style={[styles.pay, paid && { color: colors.success }]}>{paid ? "Pago." : order.status === "done" ? "Pronto, falta receber." : "Ainda não foi pago."}</Text>
          </View>
        )}

        {showMoney && customer && (
          <View style={styles.actions}>
            <PillButton label={`Ligar · ${formatPhone(customer.phone)}`} variant="secondary" full icon={<Phone size={20} color={colors.text} weight="duotone" />} onPress={() => Linking.openURL(`tel:${customer.phone}`)} />
            <PillButton label="Avisar no WhatsApp" variant="secondary" full icon={<WhatsappLogo size={20} color={colors.success} weight="duotone" />} onPress={sendUpdate} />
          </View>
        )}
      </ScrollView>

      {(owes || canNext) && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.sm }]}>
          {owes ? (
            <PillButton full label={`Receber ${formatBRL(totals.totalCents)}`} icon={<CurrencyCircleDollar size={22} color={colors.primaryFg} weight="duotone" />} onPress={() => router.push({ pathname: "/receber/[id]", params: { id: order.id } })} />
          ) : (
            <PillButton full haptic label={next === "done" ? "Marcar como pronto" : "Começar"} icon={next === "done" ? <CheckCircle size={22} color={colors.primaryFg} weight="duotone" /> : <Play size={18} color={colors.primaryFg} weight="fill" />} onPress={() => moveOrder(db, user.id, order, next!, customer?.name.split(" ")[0] ?? "Carro")} />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.md, gap: space.md, paddingBottom: 120 },
  hero: { alignItems: "center", gap: 4, paddingVertical: space.sm },
  plateWell: { padding: space.md, marginBottom: space.xs, borderRadius: radius.card, backgroundColor: colors.track },
  steps: { flexDirection: "row", padding: space.md, borderRadius: radius.card, backgroundColor: colors.surface, ...shadow.card },
  step: { flex: 1, alignItems: "center", gap: 6 },
  dot: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, zIndex: 1 },
  stepLabel: { fontSize: 12, lineHeight: 15, fontWeight: "700", color: colors.muted, textAlign: "center" },
  line: { position: "absolute", top: 17, left: "60%", right: "-40%", height: 2, backgroundColor: colors.border },
  card: { gap: space.sm, padding: space.md, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, ...shadow.card },
  desc: { fontSize: 18, lineHeight: 25, fontWeight: "600", color: colors.text },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  notes: { padding: space.sm, borderRadius: radius.field, backgroundColor: colors.warningSoft, fontSize: 15, color: colors.text },
  part: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.xs, borderTopWidth: 1, borderTopColor: colors.hairline },
  money: { fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"], color: colors.text },
  total: { fontSize: 34, lineHeight: 40, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] },
  pay: { fontSize: 15, fontWeight: "700", color: colors.warning },
  actions: { gap: space.sm },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.md, paddingTop: space.sm, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.hairline },
});
