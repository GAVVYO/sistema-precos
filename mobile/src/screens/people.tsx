import { MagnifyingGlass } from "phosphor-react-native";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatDate, formatPhone } from "@core/lib/format";
import { Avatar } from "@/components/avatar";
import { Chip } from "@/components/chip";
import { Plate } from "@/components/plate";
import { vehicleLabel } from "@/data/helpers";
import { useApp } from "@/data/store";
import { colors, radius, shadow, space, type } from "@/theme";

type Tab = "customers" | "cars";

/** Pessoas: clientes e carros (funcionários ficam no site). */
export function People() {
  const { view, customerOf } = useApp();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("customers");
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const digits = query.replace(/\D/g, "");
  const alnum = query.replace(/[^a-z0-9]/g, "");
  const customers = view.customers
    .filter((c) => !query || c.name.toLowerCase().includes(query) || (digits.length >= 3 && c.phone.includes(digits)) || view.vehicles.some((v) => v.customerId === c.id && alnum && v.plate.toLowerCase().includes(alnum)))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const cars = view.vehicles.filter((v) => !query || (alnum && v.plate.toLowerCase().includes(alnum)) || vehicleLabel(v).toLowerCase().includes(query) || (customerOf(v.customerId)?.name.toLowerCase().includes(query) ?? false));

  const header = (
    <View style={styles.header}>
      <Text style={type.title}>Pessoas</Text>
      <View style={styles.search}>
        <MagnifyingGlass size={20} color={colors.muted} weight="duotone" />
        <TextInput accessibilityLabel="Buscar por nome, telefone ou placa" placeholder="Nome, telefone ou placa" placeholderTextColor={colors.muted} value={q} onChangeText={setQ} style={styles.input} />
      </View>
      <View style={styles.seg} role="tablist">
        {([["customers", `Clientes · ${customers.length}`], ["cars", `Carros · ${cars.length}`]] as const).map(([k, label]) => (
          <Pressable key={k} role="tab" aria-selected={tab === k} onPress={() => setTab(k)} style={[styles.segItem, tab === k && styles.segOn]}>
            <Text style={[styles.segText, tab === k && styles.segTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return tab === "customers" ? (
    <FlatList
      data={customers}
      keyExtractor={(c) => c.id}
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.md }]}
      ListHeaderComponent={header}
      ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
      renderItem={({ item: c }) => {
        const vs = view.vehicles.filter((v) => v.customerId === c.id);
        const n = view.orders.filter((o) => o.customerId === c.id).length;
        return (
          <View style={styles.row} accessible accessibilityLabel={`${c.name}, ${formatPhone(c.phone)}, ${vs.length} carros`}>
            <Avatar name={c.name} size={48} />
            <View style={styles.main}>
              <Text style={type.bodyStrong} numberOfLines={1}>{c.name}</Text>
              <Text style={type.caption}>{formatPhone(c.phone)}</Text>
              <View style={styles.chips}><Chip label={`${n} ${n === 1 ? "serviço" : "serviços"}`} />{vs[0] && <Plate plate={vs[0].plate} size="sm" />}</View>
            </View>
          </View>
        );
      }}
    />
  ) : (
    <FlatList
      data={cars}
      keyExtractor={(v) => v.id}
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.md }]}
      ListHeaderComponent={header}
      ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
      renderItem={({ item: v }) => {
        const last = view.orders.filter((o) => o.vehicleId === v.id).sort((a, b) => b.openedAt.localeCompare(a.openedAt))[0];
        return (
          <View style={styles.row}>
            <Plate plate={v.plate} size="md" />
            <View style={styles.main}>
              <Text style={type.bodyStrong} numberOfLines={1}>{vehicleLabel(v)}{v.year ? ` ${v.year}` : ""}</Text>
              <Text style={type.caption} numberOfLines={1}>{customerOf(v.customerId)?.name}</Text>
              {last && <Text style={type.small}>Último serviço em {formatDate(last.openedAt).slice(0, 5)}</Text>}
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  page: { padding: space.md, paddingBottom: space.xxl * 2 },
  header: { gap: space.md, marginBottom: space.md },
  search: { flexDirection: "row", alignItems: "center", gap: space.xs, minHeight: 50, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline },
  input: { flex: 1, fontSize: 16, color: colors.text, minHeight: 48 },
  seg: { flexDirection: "row", padding: 4, gap: 4, borderRadius: radius.pill, backgroundColor: colors.track },
  segItem: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  segOn: { backgroundColor: colors.surface, ...shadow.raised },
  segText: { fontSize: 15, fontWeight: "600", color: colors.muted },
  segTextOn: { color: colors.text, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, ...shadow.card },
  main: { flex: 1, minWidth: 0, gap: 2 },
  chips: { flexDirection: "row", alignItems: "center", gap: space.xs, marginTop: 4 },
});
