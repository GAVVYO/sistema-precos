import { router, Stack } from "expo-router";
import { CaretRight, DoorOpen, Phone, WhatsappLogo } from "phosphor-react-native";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { ORDER_STATUS_LABELS } from "@core/domain/labels";
import type { ID } from "@core/domain/types";
import { formatDate, formatPhone } from "@core/lib/format";
import { Avatar } from "@/components/avatar";
import { Chip } from "@/components/chip";
import { PillButton } from "@/components/pill-button";
import { Plate } from "@/components/plate";
import { PressScale } from "@/components/press-scale";
import { vehicleLabel } from "@/data/helpers";
import { useApp } from "@/data/store";
import { colors, radius, shadow, space, stageColors, type } from "@/theme";
import { enterStagger } from "@/theme/motion";

/** Ficha do cliente: falar com ele, os carros dele e o que já foi feito. */
export function CustomerDetail({ id }: { id: ID }) {
  const { view, can } = useApp();
  const c = view.customers.find((x) => x.id === id);
  if (!c) return null;
  const cars = view.vehicles.filter((v) => v.customerId === c.id);
  const orders = view.orders.filter((o) => o.customerId === c.id && !o.cancelledAt).sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  const canOpen = can("os.create");

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: "Cliente" }} />
      <Animated.View entering={enterStagger(0)} style={styles.hero}>
        <Avatar name={c.name} size={84} />
        <Text style={[type.heading, { textAlign: "center" }]}>{c.name}</Text>
        <Text style={type.caption}>{formatPhone(c.phone)} · cliente desde {formatDate(c.createdAt).slice(0, 5)}</Text>
      </Animated.View>

      <Animated.View entering={enterStagger(1)} style={styles.talk}>
        <View style={{ flex: 1 }}><PillButton full variant="secondary" label="Ligar" icon={<Phone size={22} color={colors.text} weight="duotone" />} onPress={() => Linking.openURL(`tel:${c.phone}`)} /></View>
        <View style={{ flex: 1 }}><PillButton full variant="secondary" label="WhatsApp" icon={<WhatsappLogo size={22} color={colors.success} weight="duotone" />} onPress={() => Linking.openURL(`https://wa.me/55${c.phone}`)} /></View>
      </Animated.View>

      <Animated.View entering={enterStagger(2)} style={styles.card}>
        <Text style={type.section}>{cars.length === 1 ? "Carro" : "Carros"}</Text>
        {cars.length === 0 && <Text style={type.caption}>Nenhum carro cadastrado.</Text>}
        {cars.map((v) => (
          <View key={v.id} style={styles.car}>
            <Plate plate={v.plate} size="md" />
            <View style={{ flex: 1 }}>
              <Text style={type.bodyStrong}>{vehicleLabel(v)}{v.year ? ` ${v.year}` : ""}</Text>
              {v.mileage ? <Text style={type.caption}>{v.mileage.toLocaleString("pt-BR")} km</Text> : null}
            </View>
          </View>
        ))}
        {canOpen && cars[0] && (
          <PillButton full label="Chegou com o carro" icon={<DoorOpen size={22} color={colors.primaryFg} weight="duotone" />} onPress={() => router.push({ pathname: "/novo-servico", params: { placa: cars[0].plate } })} />
        )}
      </Animated.View>

      <Animated.View entering={enterStagger(3)} style={styles.card}>
        <Text style={type.section}>O que já foi feito</Text>
        {orders.length === 0 && <Text style={type.caption}>Nenhum serviço ainda.</Text>}
        {orders.map((o) => (
          <PressScale key={o.id} scale={0.98} accessibilityRole="button" accessibilityLabel={`${o.description}, ${formatDate(o.openedAt)}, ${ORDER_STATUS_LABELS[o.status]}. Abrir.`} onPress={() => router.push({ pathname: "/servico/[id]", params: { id: o.id } })} style={styles.order}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={type.body} numberOfLines={2}>{o.description}</Text>
              <View style={styles.chips}>
                <Chip label={formatDate(o.openedAt).slice(0, 5)} />
                <Chip label={ORDER_STATUS_LABELS[o.status]} dot={stageColors[o.status]} />
              </View>
            </View>
            <CaretRight size={20} color={colors.muted} weight="bold" />
          </PressScale>
        ))}
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.md, gap: space.md, paddingBottom: space.xxl * 2 },
  hero: { alignItems: "center", gap: 6, paddingVertical: space.sm },
  talk: { flexDirection: "row", gap: space.sm },
  card: { gap: space.sm, padding: space.md, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, ...shadow.card },
  car: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 56 },
  order: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: colors.hairline },
  chips: { flexDirection: "row", gap: 6 },
});
