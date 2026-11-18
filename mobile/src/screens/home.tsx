import { router } from "expo-router";
import { CalendarBlank, DoorOpen, Package, Plus } from "phosphor-react-native";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatBRL, todayISO, weekdayName, formatDate } from "@core/lib/format";
import { listReceivables } from "@core/services/finance";
import { partSituation } from "@core/services/stock";
import { CarCard } from "@/components/car-card";
import { PillButton } from "@/components/pill-button";
import { SectionTitle } from "@/components/section-title";
import { greeting, yard } from "@/data/helpers";
import { useApp } from "@/data/store";
import { colors, radius, shadow, space, stageColors, type } from "@/theme";

/** Hoje da recepção = o pátio (decisão 58), em uma coluna. */
export function Home() {
  const { view, user, membership } = useApp();
  const insets = useSafeAreaInsets();
  if (membership.role === "mechanic") return <MechanicHome />;
  const y = yard(view);
  const today = todayISO();
  const arrivals = view.appointments.filter((a) => a.date === today && a.status !== "cancelled" && a.status !== "attended").sort((a, b) => a.time.localeCompare(b.time));
  const owed = listReceivables(view).filter((r) => r.order).reduce((s, r) => s + r.amountCents, 0);
  const low = view.parts.filter((p) => partSituation(p) !== "ok").length;

  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + space.md }]}>
      <Text style={type.caption}>{weekdayName(today)}, {formatDate(today).slice(0, 5)}</Text>
      <Text style={type.title}>{greeting()}, {user.name.split(" ")[0]}</Text>

      <View style={styles.summary}>
        <Stat n={y.cars} label={y.cars === 1 ? "carro na oficina" : "carros na oficina"} />
        <View style={styles.divider} />
        <Stat n={y.ready.length} label="prontos esperando" color={stageColors.done} />
        <View style={styles.divider} />
        <Stat n={arrivals.length} label="chegam hoje" color={colors.primary} />
      </View>

      <PillButton label="Novo serviço" full icon={<Plus size={20} color={colors.primaryFg} weight="bold" />} onPress={() => router.push("/novo-servico")} />

      {arrivals.length > 0 && (
        <>
          <SectionTitle title="Chegam hoje" count={arrivals.length} color={colors.primary} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hscroll}>
            {arrivals.map((a) => (
              <View key={a.id} style={styles.arrival}>
                <View style={styles.arrivalTop}>
                  <CalendarBlank size={18} color={colors.primary} weight="duotone" />
                  <Text style={styles.time}>{a.time}</Text>
                </View>
                <Text style={type.bodyStrong} numberOfLines={1}>{a.customerName}</Text>
                <Text style={type.caption} numberOfLines={1}>{a.brand} {a.model}</Text>
                <Text style={type.caption} numberOfLines={1}>{a.service}</Text>
                <PillButton label="Chegou" variant="secondary" icon={<DoorOpen size={18} color={colors.text} weight="duotone" />} onPress={() => router.push("/novo-servico")} />
              </View>
            ))}
          </ScrollView>
        </>
      )}

      <Lane title="Esperando começar" color={stageColors.waiting} orders={y.waiting} />
      <Lane title="Sendo feito" color={stageColors.in_progress} orders={y.doing} />
      <Lane title="Pronto, esperando o cliente" color={stageColors.done} orders={y.ready} hint={owed ? `${formatBRL(owed)} a receber` : undefined} />

      {low > 0 && (
        <View style={styles.note}>
          <Package size={22} color={colors.warning} weight="duotone" />
          <Text style={[type.body, { flex: 1 }]}><Text style={{ fontWeight: "700" }}>{low} peças acabando.</Text> Veja no computador.</Text>
        </View>
      )}
    </ScrollView>
  );
}

function Stat({ n, label, color = colors.text }: { n: number; label: string; color?: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${n} ${label}`}>
      <Text style={[type.number, { color }]}>{n}</Text>
      <Text style={styles.statLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

function Lane({ title, color, orders, hint }: { title: string; color: string; orders: import("@core/domain/types").ServiceOrder[]; hint?: string }) {
  if (!orders.length) return null;
  return (
    <View style={styles.lane}>
      <SectionTitle title={title} count={orders.length} color={color} hint={hint} />
      {orders.map((o) => <CarCard key={o.id} order={o} />)}
    </View>
  );
}

/** Mecânico: "Seus carros" — só os dele, sem dinheiro. */
function MechanicHome() {
  const { view, user } = useApp();
  const insets = useSafeAreaInsets();
  const mine = view.orders.filter((o) => !o.cancelledAt && o.mechanicId === user.id);
  const doing = mine.filter((o) => o.status === "in_progress");
  const waiting = mine.filter((o) => o.status === "waiting");
  const free = view.orders.filter((o) => !o.cancelledAt && o.status === "waiting" && !o.mechanicId).length;
  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + space.md }]}>
      <Text style={type.caption}>{greeting()}, {user.name.split(" ")[0]}</Text>
      <Text style={type.title}>Seus carros</Text>
      {doing.length + waiting.length === 0 && <Text style={type.body}>Nenhum carro com você agora.</Text>}
      {doing.length > 0 && <View style={styles.lane}><SectionTitle title="Você está fazendo" count={doing.length} color={stageColors.in_progress} />{doing.map((o) => <CarCard key={o.id} order={o} hideMoney hideMechanic />)}</View>}
      {waiting.length > 0 && <View style={styles.lane}><SectionTitle title="Para você começar" count={waiting.length} color={stageColors.waiting} />{waiting.map((o) => <CarCard key={o.id} order={o} hideMoney hideMechanic />)}</View>}
      {free > 0 && <View style={styles.note}><Text style={[type.body, { flex: 1 }]}>{free === 1 ? "1 carro está" : `${free} carros estão`} esperando alguém pegar.</Text></View>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.md, gap: space.md, paddingBottom: space.xxl * 2 },
  summary: { flexDirection: "row", alignItems: "stretch", padding: space.md, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, ...shadow.card },
  stat: { flex: 1, gap: 2 },
  statLabel: { fontSize: 13, lineHeight: 17, fontWeight: "600", color: colors.muted },
  divider: { width: 1, backgroundColor: colors.hairline, marginHorizontal: space.sm },
  hscroll: { gap: space.sm, paddingRight: space.md },
  arrival: { width: 220, gap: 4, padding: space.md, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, ...shadow.card },
  arrivalTop: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  time: { fontSize: 22, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] },
  lane: { gap: space.sm },
  note: { flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.md, borderRadius: radius.card, backgroundColor: colors.warningSoft },
});
