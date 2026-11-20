import { router } from "expo-router";
import { CaretRight, MagnifyingGlass, UserPlus } from "phosphor-react-native";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatPhone } from "@core/lib/format";
import { Avatar } from "@/components/avatar";
import { PillButton } from "@/components/pill-button";
import { Plate } from "@/components/plate";
import { PressScale } from "@/components/press-scale";
import { useApp } from "@/data/store";
import { colors, radius, shadow, space, type } from "@/theme";
import { reflow } from "@/theme/motion";

/** Clientes: buscar por nome, telefone ou placa e abrir a ficha. Simples (19/11). */
export function People() {
  const { view, can } = useApp();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const digits = query.replace(/\D/g, "");
  const alnum = query.replace(/[^a-z0-9]/g, "");
  const customers = view.customers
    .filter((c) => !query || c.name.toLowerCase().includes(query) || (digits.length >= 3 && c.phone.includes(digits)) || view.vehicles.some((v) => v.customerId === c.id && alnum && v.plate.toLowerCase().includes(alnum)))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const canAdd = can("os.create") || can("os.edit") || can("schedule.manage");

  return (
    <Animated.FlatList
      data={customers}
      keyExtractor={(c) => c.id}
      itemLayoutAnimation={reflow}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.md }]}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={type.title}>Clientes</Text>
            {canAdd && <PillButton label="Novo cliente" icon={<UserPlus size={18} color={colors.primaryFg} weight="bold" />} onPress={() => router.push("/novo-cliente")} />}
          </View>
          <View style={styles.search}>
            <MagnifyingGlass size={22} color={colors.muted} weight="duotone" />
            <TextInput accessibilityLabel="Buscar por nome, telefone ou placa" placeholder="Nome, telefone ou placa" placeholderTextColor={colors.muted} value={q} onChangeText={setQ} style={styles.input} />
          </View>
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
      ListEmptyComponent={<Text style={[type.body, styles.empty]}>{query ? "Ninguém com esse nome, telefone ou placa." : "Nenhum cliente ainda."}</Text>}
      renderItem={({ item: c }) => {
        // A placa só aparece quando a busca foi por placa; senão o nome fica inteiro.
        const car = alnum.length >= 2 ? view.vehicles.find((v) => v.customerId === c.id && v.plate.toLowerCase().includes(alnum)) : undefined;
        return (
          <PressScale scale={0.98} accessibilityRole="button" accessibilityLabel={`${c.name}, ${formatPhone(c.phone)}. Abrir ficha.`} onPress={() => router.push({ pathname: "/cliente/[id]", params: { id: c.id } })} style={styles.row}>
            <Avatar name={c.name} size={52} />
            <View style={styles.main}>
              <Text style={styles.name} numberOfLines={2}>{c.name}</Text>
              <Text style={type.caption}>{formatPhone(c.phone)}</Text>
            </View>
            {car && <Plate plate={car.plate} size="sm" />}
            <CaretRight size={20} color={colors.muted} weight="bold" />
          </PressScale>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  page: { padding: space.md, paddingBottom: space.xxl * 2 },
  header: { gap: space.md, marginBottom: space.md },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  search: { flexDirection: "row", alignItems: "center", gap: space.xs, minHeight: 54, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline },
  input: { flex: 1, fontSize: 17, color: colors.text, minHeight: 50 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 76, paddingHorizontal: space.md, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, ...shadow.card },
  main: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 18, fontWeight: "800", color: colors.text },
  empty: { textAlign: "center", color: colors.muted, padding: space.xl },
});
