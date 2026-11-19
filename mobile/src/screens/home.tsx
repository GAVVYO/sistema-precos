import { router } from "expo-router";
import { Car, CurrencyCircleDollar, MagnifyingGlass, Plus } from "phosphor-react-native";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatDate, todayISO, weekdayName } from "@core/lib/format";
import { BigTile } from "@/components/big-tile";
import { CarCard } from "@/components/car-card";
import { greeting, yard } from "@/data/helpers";
import { useApp } from "@/data/store";
import { colors, space, type } from "@/theme";

/**
 * Tela inicial em botões grandes (escolha do dono, 19/11): quatro tarefas,
 * uma palavra cada, quase nada para ler.
 */
export function Home() {
  const { view, user, membership } = useApp();
  const insets = useSafeAreaInsets();
  if (membership.role === "mechanic") return <MechanicHome />;
  const y = yard(view);
  const today = todayISO();
  const arrivals = view.appointments.filter((a) => a.date === today && a.status !== "cancelled" && a.status !== "attended").length;

  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + space.lg }]}>
      <Text style={type.caption}>{weekdayName(today)}, {formatDate(today).slice(0, 5)}</Text>
      <Text style={type.title}>{greeting()}, {user.name.split(" ")[0]}</Text>

      <View style={styles.grid}>
        <View style={styles.row}>
          <BigTile filled label="Chegou carro" icon={(c) => <Plus size={34} color={c} weight="bold" />} onPress={() => router.push("/novo-servico")} hint="Abre um serviço novo" />
          <BigTile label="Carros na oficina" count={y.cars} icon={(c) => <Car size={36} color={c} weight="duotone" />} onPress={() => router.push("/servicos")} />
        </View>
        <View style={styles.row}>
          <BigTile label="Receber" count={y.ready.length} icon={(c) => <CurrencyCircleDollar size={36} color={c} weight="duotone" />} onPress={() => router.push({ pathname: "/servicos", params: { etapa: "done" } })} hint="Carros prontos que faltam pagar" />
          <BigTile label="Procurar cliente" icon={(c) => <MagnifyingGlass size={36} color={c} weight="duotone" />} onPress={() => router.push("/pessoas")} />
        </View>
      </View>

      {arrivals > 0 && <Text style={styles.hint}>{arrivals === 1 ? "1 cliente marcado para hoje." : `${arrivals} clientes marcados para hoje.`}</Text>}
    </ScrollView>
  );
}

/** Mecânico: só os carros dele, numa lista simples. */
function MechanicHome() {
  const { view, user } = useApp();
  const insets = useSafeAreaInsets();
  const mine = view.orders
    .filter((o) => !o.cancelledAt && o.mechanicId === user.id && o.status !== "done")
    .sort((a, b) => (a.status === b.status ? a.openedAt.localeCompare(b.openedAt) : a.status === "in_progress" ? -1 : 1));
  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + space.lg }]}>
      <Text style={type.caption}>{greeting()}, {user.name.split(" ")[0]}</Text>
      <Text style={type.title}>Seus carros</Text>
      {mine.length === 0 ? <Text style={type.body}>Nenhum carro com você agora.</Text> : mine.map((o) => <CarCard key={o.id} order={o} />)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.md, gap: space.md, paddingBottom: space.xxl },
  grid: { gap: space.md, marginTop: space.sm },
  row: { flexDirection: "row", gap: space.md },
  hint: { fontSize: 16, color: colors.muted, textAlign: "center", marginTop: space.sm },
});
