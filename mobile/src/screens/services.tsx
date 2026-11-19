import { router, useLocalSearchParams } from "expo-router";
import { CheckCircle, HourglassMedium, MagnifyingGlass, Plus, SealCheck, Wrench } from "phosphor-react-native";
import { useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { OrderStatus } from "@core/domain/types";
import { formatOrderNumber } from "@core/lib/format";
import { CarCard } from "@/components/car-card";
import { PillButton } from "@/components/pill-button";
import { StageTabs } from "@/components/stage-tabs";
import { vehicleLabel } from "@/data/helpers";
import { useApp } from "@/data/store";
import { colors, radius, space, stageColors, type } from "@/theme";

const LABEL: Record<OrderStatus, string> = { waiting: "Aguardando", in_progress: "Em andamento", done: "Pronto" };

/** Serviços: uma etapa por vez (decisão 59). */
export function Services() {
  const { view, customerOf, vehicleOf } = useApp();
  const insets = useSafeAreaInsets();
  const { etapa } = useLocalSearchParams<{ etapa?: OrderStatus }>();
  const [stage, setStage] = useState<OrderStatus>(etapa ?? "waiting");
  // Vindo do botão "Receber" da tela inicial, abre direto em Pronto.
  const [lastParam, setLastParam] = useState(etapa);
  if (etapa !== lastParam) { setLastParam(etapa); if (etapa) setStage(etapa); }
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const all = view.orders.filter((o) => !o.cancelledAt).filter((o) => {
    if (!query) return true;
    const v = vehicleOf(o.vehicleId);
    return `${formatOrderNumber(o.number)} ${customerOf(o.customerId)?.name} ${vehicleLabel(v)} ${v?.plate}`.toLowerCase().includes(query.replace(/[^a-z0-9 ]/g, ""));
  });
  const list = all.filter((o) => o.status === stage).sort((a, b) => (stage === "done" ? b.openedAt.localeCompare(a.openedAt) : a.openedAt.localeCompare(b.openedAt)));
  const icons = { waiting: HourglassMedium, in_progress: Wrench, done: SealCheck };

  return (
    <FlatList
      data={list}
      keyExtractor={(o) => o.id}
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.md }]}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={type.title}>Carros</Text>
            <PillButton label="Chegou carro" icon={<Plus size={18} color={colors.primaryFg} weight="bold" />} onPress={() => router.push("/novo-servico")} />
          </View>
          <View style={styles.search}>
            <MagnifyingGlass size={20} color={colors.muted} weight="duotone" />
            <TextInput accessibilityLabel="Buscar placa, nome ou número" placeholder="Placa, nome ou nº do serviço" placeholderTextColor={colors.muted} value={q} onChangeText={setQ} style={styles.input} autoCapitalize="characters" />
          </View>
          <StageTabs
            value={stage}
            onChange={setStage}
            tabs={(["waiting", "in_progress", "done"] as const).map((s) => {
              const Icon = icons[s];
              return { key: s, label: LABEL[s], count: all.filter((o) => o.status === s).length, color: stageColors[s], icon: (c: string) => <Icon size={20} color={c} weight="duotone" /> };
            })}
          />
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
      renderItem={({ item }) => <CarCard order={item} />}
      ListEmptyComponent={
        <View style={styles.empty}>
          <CheckCircle size={40} color={stageColors[stage]} weight="duotone" />
          <Text style={type.section}>{query ? "Nada encontrado aqui" : `Nenhum carro em ${LABEL[stage]}`}</Text>
          <Text style={[type.caption, { textAlign: "center" }]}>{query ? "Confira a placa ou o nome, ou veja as outras abas." : "Quando houver, eles aparecem aqui."}</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  page: { padding: space.md, paddingBottom: space.xxl * 2 },
  header: { gap: space.md, marginBottom: space.md },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  search: { flexDirection: "row", alignItems: "center", gap: space.xs, minHeight: 50, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline },
  input: { flex: 1, fontSize: 16, color: colors.text, minHeight: 48 },
  empty: { alignItems: "center", gap: space.xs, padding: space.xxl, borderRadius: radius.card, backgroundColor: colors.surface },
});
