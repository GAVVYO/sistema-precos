import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { ArrowLeft, Check } from "phosphor-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ID } from "@core/domain/types";
import { formatPhone, normalizePlate } from "@core/lib/format";
import { maskPhone, maskPlate } from "@core/lib/masks";
import { createOrder } from "@core/services/orders";
import { Avatar } from "@/components/avatar";
import { PillButton } from "@/components/pill-button";
import { Plate } from "@/components/plate";
import { vehicleLabel } from "@/data/helpers";
import { act, useApp } from "@/data/store";
import { colors, radius, shadow, space, type } from "@/theme";

const SUGGESTIONS = ["Troca de óleo", "Revisão", "Freios", "Alinhamento", "Suspensão", "Diagnóstico elétrico"];
const BRANDS = ["Fiat", "Volkswagen", "Chevrolet", "Toyota", "Hyundai", "Renault", "Honda", "Jeep"];

type Step = "plate" | "car" | "customer" | "work" | "who" | "review";

/** Novo serviço, uma pergunta por vez (decisão 56). Usa o createOrder do site. */
export function NewOrder() {
  const { view } = useApp();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>("plate");
  const [plate, setPlate] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [work, setWork] = useState("");
  const [mechanicId, setMechanicId] = useState<ID | "">("");
  const [error, setError] = useState("");

  const norm = normalizePlate(plate);
  const found = norm ? view.vehicles.find((v) => v.plate === norm) : undefined;
  const owner = found ? view.customers.find((c) => c.id === found.customerId) : undefined;
  const mechanics = view.memberships.filter((m) => m.active && m.role === "mechanic").map((m) => view.users.find((u) => u.id === m.userId)!);
  const order: Step[] = found ? ["plate", "work", "who", "review"] : ["plate", "car", "customer", "work", "who", "review"];
  const i = order.indexOf(step);

  const go = (to: Step) => { setError(""); setStep(to); };
  const next = () => {
    if (step === "plate" && !norm) return setError("Digite a placa completa. Ex.: ABC1D23");
    if (step === "car" && (!brand || !model.trim())) return setError("Escolha a marca e escreva o modelo.");
    if (step === "customer" && (name.trim().length < 2 || phone.replace(/\D/g, "").length < 10)) return setError("Escreva o nome e o telefone com DDD.");
    if (step === "work" && work.trim().length < 3) return setError("Escreva o que o cliente pediu.");
    if (step === "review") return save();
    go(order[i + 1]);
  };
  const save = () => {
    const r = act((d, c) => {
      createOrder(d, c, {
        customer: owner ? { id: owner.id } : { name, phone },
        vehicle: found ? { id: found.id } : { plate: norm!, brand, model, year: null, mileage: null },
        description: work,
        notes: "",
        mechanicId: mechanicId || null,
        laborCents: null,
        items: [],
      });
    });
    if (!r.ok) return setError(r.message);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.progress} accessibilityLabel={`Passo ${i + 1} de ${order.length}`}>
        {order.map((s, k) => <View key={s} style={[styles.bar, k <= i && styles.barOn]} />)}
      </View>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        {step === "plate" && (
          <>
            <Text style={type.heading}>Qual a placa do carro?</Text>
            <View style={styles.plateInput}>
              <View style={styles.plateBand}><Text style={styles.plateBandText}>BRASIL</Text></View>
              <TextInput accessibilityLabel="Placa do carro" value={plate} onChangeText={(t) => setPlate(maskPlate(t))} autoCapitalize="characters" autoCorrect={false} autoFocus placeholder="ABC1D23" placeholderTextColor="#cbd2dc" style={styles.plateText} maxLength={7} />
            </View>
            {found && owner && (
              <View style={styles.found}>
                <Check size={22} color={colors.success} weight="bold" />
                <View style={{ flex: 1 }}>
                  <Text style={type.bodyStrong}>É o {vehicleLabel(found)} de {owner.name.split(" ")[0]}</Text>
                  <Text style={type.caption}>{owner.name} · {formatPhone(owner.phone)}</Text>
                </View>
              </View>
            )}
            {norm && !found && <Text style={type.caption}>Carro novo. Nos próximos passos você cadastra o carro e o cliente.</Text>}
          </>
        )}
        {step === "car" && (
          <>
            <Text style={type.heading}>Qual é o carro?</Text>
            <Text style={type.label}>Marca</Text>
            <View style={styles.chips}>
              {BRANDS.map((b) => <Choice key={b} label={b} on={brand === b} onPress={() => setBrand(b)} />)}
            </View>
            <Text style={type.label}>Modelo</Text>
            <TextInput accessibilityLabel="Modelo" value={model} onChangeText={setModel} placeholder="Ex.: Uno, Onix, Gol" placeholderTextColor={colors.muted} style={styles.input} />
          </>
        )}
        {step === "customer" && (
          <>
            <Text style={type.heading}>De quem é o carro?</Text>
            <Text style={type.label}>Nome do cliente</Text>
            <TextInput accessibilityLabel="Nome do cliente" value={name} onChangeText={setName} style={styles.input} autoFocus />
            <Text style={type.label}>Telefone (WhatsApp)</Text>
            <TextInput accessibilityLabel="Telefone" value={phone} onChangeText={(t) => setPhone(maskPhone(t))} keyboardType="phone-pad" style={styles.input} placeholder="(85) 98888-7777" placeholderTextColor={colors.muted} />
          </>
        )}
        {step === "work" && (
          <>
            <Text style={type.heading}>O que o cliente pediu?</Text>
            <View style={styles.chips}>
              {SUGGESTIONS.map((s) => <Choice key={s} label={s} on={work === s} onPress={() => setWork(s)} />)}
            </View>
            <TextInput accessibilityLabel="O que vai ser feito" value={work} onChangeText={setWork} placeholder="Ou escreva aqui" placeholderTextColor={colors.muted} style={[styles.input, { minHeight: 96, textAlignVertical: "top", paddingTop: 14 }]} multiline />
          </>
        )}
        {step === "who" && (
          <>
            <Text style={type.heading}>Quem vai fazer?</Text>
            {[{ id: "", name: "Ainda não sei" }, ...mechanics].map((m) => {
              const on = mechanicId === m.id;
              const load = m.id ? view.orders.filter((o) => !o.cancelledAt && o.mechanicId === m.id && o.status === "in_progress").length : 0;
              return (
                <Pressable key={m.id || "none"} role="radio" aria-checked={on} onPress={() => setMechanicId(m.id)} style={[styles.person, on && styles.personOn]}>
                  {m.id ? <Avatar name={m.name} size={44} /> : <View style={styles.unknown}><Text style={styles.unknownQ}>?</Text></View>}
                  <View style={{ flex: 1 }}>
                    <Text style={type.bodyStrong}>{m.name}</Text>
                    {m.id ? <Text style={type.caption}>{load === 0 ? "Livre agora" : `${load} ${load === 1 ? "carro" : "carros"} agora`}</Text> : null}
                  </View>
                  <View style={[styles.radio, on && styles.radioOn]} />
                </Pressable>
              );
            })}
          </>
        )}
        {step === "review" && (
          <>
            <Text style={type.heading}>Confere e abre</Text>
            <View style={styles.review}>
              <Plate plate={norm ?? ""} size="md" />
              <Text style={type.section}>{found ? vehicleLabel(found) : `${brand} ${model}`}</Text>
              <Text style={type.caption}>{owner?.name ?? name} · {owner ? formatPhone(owner.phone) : phone}</Text>
              <Text style={styles.reviewWork}>{work}</Text>
              <Text style={type.caption}>{mechanicId ? `Com ${mechanics.find((m) => m.id === mechanicId)?.name}` : "Quem faz: ainda não sei"}</Text>
            </View>
          </>
        )}
        {error ? <Text style={styles.error} role="alert">{error}</Text> : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + space.sm }]}>
        {i > 0 && <PillButton label="Voltar" variant="secondary" icon={<ArrowLeft size={18} color={colors.text} weight="bold" />} onPress={() => go(order[i - 1])} />}
        <View style={{ flex: 1 }}><PillButton full label={step === "review" ? "Abrir serviço" : "Continuar"} onPress={next} /></View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Choice({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable role="radio" aria-checked={on} onPress={onPress} style={[styles.choice, on && styles.choiceOn]}>
      <Text style={[styles.choiceText, on && { color: colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: "row", gap: 6, paddingHorizontal: space.md, paddingTop: space.sm },
  bar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.track },
  barOn: { backgroundColor: colors.primary },
  page: { padding: space.md, gap: space.md, paddingBottom: 140 },
  plateInput: { alignSelf: "center", width: "100%", maxWidth: 360, borderWidth: 3, borderColor: "#1f2937", borderRadius: 14, backgroundColor: "#fff", overflow: "hidden", ...shadow.card },
  plateBand: { height: 26, backgroundColor: "#1d4ed8", alignItems: "center", justifyContent: "center" },
  plateBandText: { color: "#fff", fontWeight: "800", letterSpacing: 6, fontSize: 12 },
  plateText: { height: 84, textAlign: "center", fontSize: 44, fontWeight: "800", letterSpacing: 4, color: "#111827", fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) },
  found: { flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.md, borderRadius: radius.card, backgroundColor: colors.successSoft },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  choice: { minHeight: 48, paddingHorizontal: space.md, justifyContent: "center", borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  choiceOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  choiceText: { fontSize: 16, fontWeight: "600", color: colors.text },
  input: { minHeight: 52, paddingHorizontal: space.md, borderRadius: radius.field, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, fontSize: 17, color: colors.text },
  person: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 68, paddingHorizontal: space.md, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.hairline },
  personOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  unknown: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.track },
  unknownQ: { fontSize: 18, fontWeight: "800", color: colors.muted },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border },
  radioOn: { borderColor: colors.primary, borderWidth: 7 },
  review: { alignItems: "center", gap: space.xs, padding: space.lg, borderRadius: radius.card, backgroundColor: colors.surface, ...shadow.card },
  reviewWork: { fontSize: 18, fontWeight: "600", color: colors.text, textAlign: "center", marginTop: space.xs },
  error: { fontSize: 15, color: colors.danger, fontWeight: "600" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: space.sm, padding: space.md, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.hairline },
});
