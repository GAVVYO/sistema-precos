import { CheckCircle, Hourglass, Play, SealCheck, Wrench } from "phosphor-react-native";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { buildSeed, DEMO_WORKSHOP_ID } from "@core/demo/seed";
import { ORDER_STATUS_LABELS } from "@core/domain/labels";
import type { OrderStatus } from "@core/domain/types";
import { formatBRL, formatPhone, parseBRL } from "@core/lib/format";
import { maskMoney, maskPhone } from "@core/lib/masks";
import { Avatar } from "@/components/avatar";
import { Chip } from "@/components/chip";
import { PillButton } from "@/components/pill-button";
import { Plate } from "@/components/plate";
import { StageTabs } from "@/components/stage-tabs";
import { colors, radius, shadow, space, stageColors, type } from "@/theme";

/**
 * Etapa E0: prova de que o app usa as MESMAS regras do site (seed, formatação,
 * máscaras) e vitrine dos componentes base. Some quando as telas reais chegarem.
 */
export function BaseProof() {
  const db = useMemo(() => buildSeed(), []);
  const customers = db.customers.filter((c) => c.workshopId === DEMO_WORKSHOP_ID).slice(0, 3);
  const orders = db.orders.filter((o) => o.workshopId === DEMO_WORKSHOP_ID && !o.cancelledAt);
  const [stage, setStage] = useState<OrderStatus>("waiting");
  const [money, setMoney] = useState("1500");
  const [phone, setPhone] = useState(maskPhone("85988887777"));
  const count = (s: OrderStatus) => orders.filter((o) => o.status === s).length;
  const icon = { waiting: Hourglass, in_progress: Wrench, done: SealCheck } as const;

  return (
    <ScrollView contentContainerStyle={styles.page} contentInsetAdjustmentBehavior="automatic">
      <Text style={type.title}>Base do app</Text>
      <Text style={type.caption}>Etapa E0 · regras e dados vêm do site, sem cópia.</Text>

      <View style={styles.card}>
        <Text style={type.section}>Clientes do seed do site</Text>
        {customers.map((c) => {
          const car = db.vehicles.find((v) => v.customerId === c.id);
          return (
            <View key={c.id} style={styles.row}>
              <Avatar name={c.name} size={44} />
              <View style={styles.rowMain}>
                <Text style={type.bodyStrong} numberOfLines={1}>{c.name}</Text>
                <Text style={type.caption}>{formatPhone(c.phone)}</Text>
              </View>
              {car && <Plate plate={car.plate} size="sm" />}
            </View>
          );
        })}
      </View>

      <View style={styles.card}>
        <Text style={type.section}>Máscaras do site</Text>
        <Text style={type.label}>Quanto? (R$)</Text>
        <TextInput accessibilityLabel="Quanto em reais" style={styles.input} keyboardType="decimal-pad" value={money} onChangeText={(v) => setMoney(maskMoney(v))} />
        <Text style={type.caption}>Vira {formatBRL(parseBRL(money) ?? 0)} no sistema.</Text>
        <Text style={[type.label, { marginTop: space.sm }]}>Telefone (WhatsApp)</Text>
        <TextInput accessibilityLabel="Telefone" style={styles.input} keyboardType="phone-pad" value={phone} onChangeText={(v) => setPhone(maskPhone(v))} />
      </View>

      <View style={styles.card}>
        <Text style={type.section}>Abas de etapa</Text>
        <StageTabs
          value={stage}
          onChange={setStage}
          tabs={(["waiting", "in_progress", "done"] as const).map((s) => {
            const Icon = icon[s];
            return { key: s, label: ORDER_STATUS_LABELS[s], count: count(s), color: stageColors[s], icon: (c: string) => <Icon size={20} color={c} weight="duotone" /> };
          })}
        />
        <View style={styles.chips}>
          <Chip label="Serviço nº 10" dot={stageColors[stage]} tone="primary" />
          <Chip label="Raimundo Nonato" />
          <Chip label="Chegou ontem" />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={type.section}>Botões</Text>
        <PillButton label="Começar" icon={<Play size={18} color={colors.primaryFg} weight="fill" />} onPress={() => {}} haptic />
        <PillButton label="Marcar como pronto" icon={<CheckCircle size={20} color={colors.primaryFg} weight="duotone" />} onPress={() => {}} full haptic />
        <View style={styles.chips}>
          <PillButton label="Editar" variant="secondary" onPress={() => {}} />
          <PillButton label="Ver tudo" variant="ghost" onPress={() => {}} />
          <PillButton label="Cancelar" variant="danger" onPress={() => {}} />
        </View>
        <Plate plate="QRT4J58" size="lg" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.md, gap: space.md, paddingBottom: space.xxl },
  card: { gap: space.sm, padding: space.md, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, ...shadow.card },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 56 },
  rowMain: { flex: 1, minWidth: 0 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  input: { minHeight: 48, paddingHorizontal: space.md, borderRadius: radius.field, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, fontSize: 16, color: colors.text },
});
