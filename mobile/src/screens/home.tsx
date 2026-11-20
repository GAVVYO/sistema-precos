import { router } from "expo-router";
import { CheckCircle, HourglassMedium, MagnifyingGlass, Plus, Wrench } from "phosphor-react-native";
import type { ReactNode } from "react";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ServiceOrder } from "@core/domain/types";
import { formatBRL, formatDate, todayISO, weekdayName } from "@core/lib/format";
import { financeSummary } from "@core/services/finance";
import { CarCard } from "@/components/car-card";
import { PressScale } from "@/components/press-scale";
import { greeting, yard } from "@/data/helpers";
import { useApp } from "@/data/store";
import { colors, radius, shadow, space, stageColors, type } from "@/theme";
import { EASE_OUT, reflow } from "@/theme/motion";

/**
 * Pátio (decisão 76): a primeira tela depois de entrar. Os carros separados
 * pela situação, cada um com o botão da próxima ação. Sem menu de botões.
 * - Mecânico: só os carros dele ("Comecei" / "Ficou pronto").
 * - Recepção: o pátio inteiro, "Chegou carro" fixo e "Receber" nos prontos.
 * - Dono: o mesmo, mais o resumo do dia no topo.
 */
export function Home() {
  const { view, user, membership, can, customerOf, vehicleOf } = useApp();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const mechanic = membership.role === "mechanic";
  const today = todayISO();
  const y = yard(view);

  const query = q.trim().toLowerCase().replace(/[^a-z0-9à-ú ]/g, "");
  const match = (o: ServiceOrder) => {
    if (!query) return true;
    const v = vehicleOf(o.vehicleId);
    return [v?.plate, v?.model, customerOf(o.customerId)?.name].some((t) => t?.toLowerCase().replace(/[^a-z0-9à-ú ]/g, "").includes(query));
  };
  const mine = (o: ServiceOrder) => !mechanic || o.mechanicId === user.id;
  const ready = mechanic ? [] : y.ready.filter(match);
  const doing = y.doing.filter(mine).filter(match);
  const waiting = y.waiting.filter(mine).filter(match);
  const empty = !ready.length && !doing.length && !waiting.length;
  const received = can("finance.view") ? financeSummary(view, today, today).receivedCents : null;
  const canNew = can("os.create") && !mechanic;

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + space.md, paddingBottom: canNew ? 120 : space.xxl }]} keyboardShouldPersistTaps="handled">
        <Text style={type.caption}>{weekdayName(today)}, {formatDate(today).slice(0, 5)}</Text>
        <Text style={type.title}>{greeting()}, {user.name.split(" ")[0]}</Text>

        {!mechanic && (
          <Animated.View entering={FadeInDown.duration(320).easing(EASE_OUT)} style={styles.summary}>
            <Stat label="Na oficina" value={String(y.cars)} />
            <Stat label="Para receber" value={String(y.ready.length)} tone={y.ready.length ? stageColors.done : undefined} />
            {received !== null && <Stat label="Entrou hoje" value={formatBRL(received)} />}
          </Animated.View>
        )}

        <View style={styles.search}>
          <MagnifyingGlass size={20} color={colors.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Placa ou nome do cliente" placeholderTextColor={colors.muted} style={styles.searchInput} autoCapitalize="characters" autoCorrect={false} aria-label="Procurar carro por placa ou cliente" returnKeyType="search" />
        </View>

        {empty && (
          <Animated.Text entering={FadeIn} style={styles.empty}>
            {query ? "Nenhum carro com essa placa ou nome." : mechanic ? "Nenhum carro com você agora." : "Nenhum carro na oficina agora."}
          </Animated.Text>
        )}

        {!!ready.length && <Section title="Pronto para entregar" sub="Falta receber" color={stageColors.done} icon={<CheckCircle size={20} color={stageColors.done} weight="duotone" />} orders={ready} />}
        {!!doing.length && <Section title={mechanic ? "Fazendo agora" : "Sendo feito"} color={stageColors.in_progress} icon={<Wrench size={20} color={stageColors.in_progress} weight="duotone" />} orders={doing} />}
        {!!waiting.length && <Section title="Esperando começar" color={stageColors.waiting} icon={<HourglassMedium size={20} color={stageColors.waiting} weight="duotone" />} orders={waiting} />}
      </ScrollView>

      {canNew && (
        <Animated.View entering={FadeInDown.duration(380).delay(250).easing(EASE_OUT)} style={[styles.fabWrap, { bottom: space.md }]} pointerEvents="box-none">
          <PressScale scale={0.96} accessibilityRole="button" accessibilityLabel="Chegou carro" accessibilityHint="Abre um serviço novo" onPress={() => router.push("/novo-servico")} style={styles.fab}>
            <Plus size={24} color={colors.primaryFg} weight="bold" />
            <Text style={styles.fabText}>Chegou carro</Text>
          </PressScale>
        </Animated.View>
      )}
    </View>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, tone ? { color: tone } : null]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, sub, color, icon, orders }: { title: string; sub?: string; color: string; icon: ReactNode; orders: ServiceOrder[] }) {
  return (
    <Animated.View layout={reflow} style={styles.section}>
      <View style={styles.sectionHead} accessibilityRole="header">
        {icon}
        <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
        <View style={[styles.count, { backgroundColor: color }]}><Text style={styles.countText}>{orders.length}</Text></View>
        {sub && <Text style={styles.sectionSub}>{sub}</Text>}
      </View>
      {orders.map((o, i) => (
        <Animated.View key={o.id} entering={FadeInDown.duration(260).delay(Math.min(i, 5) * 40).easing(EASE_OUT)} exiting={FadeOut.duration(160)} layout={reflow}>
          <CarCard order={o} />
        </Animated.View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  page: { padding: space.md, gap: space.md },
  summary: { flexDirection: "row", gap: space.xs, padding: space.sm, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline },
  stat: { flex: 1, alignItems: "center", gap: 2, paddingVertical: space.xs },
  statValue: { fontSize: 22, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 13, fontWeight: "600", color: colors.muted },
  search: { flexDirection: "row", alignItems: "center", gap: space.xs, height: 52, paddingHorizontal: 14, borderRadius: radius.field, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  searchInput: { flex: 1, height: "100%", fontSize: 17, color: colors.text },
  empty: { fontSize: 17, color: colors.muted, textAlign: "center", marginTop: space.xl },
  section: { gap: space.sm },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: space.xs, marginTop: space.xs },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  count: { minWidth: 26, height: 26, paddingHorizontal: 7, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  countText: { fontSize: 14, fontWeight: "800", color: "#fff" },
  sectionSub: { marginLeft: "auto", fontSize: 14, color: colors.muted },
  fabWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  fab: { flexDirection: "row", alignItems: "center", gap: space.xs, height: 60, paddingHorizontal: 28, borderRadius: 30, backgroundColor: colors.primary, ...shadow.card, shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  fabText: { fontSize: 18, fontWeight: "800", color: colors.primaryFg },
});
