import { router } from "expo-router";
import { CaretDown, CaretUp } from "phosphor-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { normalizePlate } from "@core/lib/format";
import { maskPhone, maskPlate } from "@core/lib/masks";
import { createCustomer, saveVehicle } from "@core/services/customers";
import { BadgeCard } from "@/components/badge-card";
import { PillButton } from "@/components/pill-button";
import { act, useApp } from "@/data/store";
import { colors, radius, space, type } from "@/theme";
import { softIn } from "@/theme/motion";

/** Novo cliente: crachá que se preenche + carimbo "Cadastro concluído". */
export function NewCustomer() {
  const { view } = useApp();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [showCar, setShowCar] = useState(false);
  const [plate, setPlate] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [error, setError] = useState("");
  const [stamped, setStamped] = useState(false);

  const save = () => {
    const norm = normalizePlate(plate);
    if (plate && !norm) return setError("Placa incompleta. Ex.: ABC1D23");
    if (norm && (brand.trim().length < 2 || !model.trim())) return setError("Escreva a marca e o modelo do carro.");
    const r = act((d, c) => {
      const cu = createCustomer(d, c, { name, phone });
      if (norm) saveVehicle(d, c, cu.id, { plate: norm, brand, model, year: null, mileage: null });
    });
    if (!r.ok) return setError(r.message);
    setError("");
    setStamped(true);
    setTimeout(() => router.back(), reduced ? 1100 : 1900);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <BadgeCard name={name} phone={phone} plate={normalizePlate(plate) ?? undefined} workshop={view.settings?.displayName ?? "Oficina"} stamped={stamped} />
        {stamped && <Text style={styles.sr} accessibilityLiveRegion="polite" role="status">Cadastro concluído.</Text>}

        <Text style={type.label}>Nome do cliente</Text>
        <TextInput accessibilityLabel="Nome do cliente" value={name} onChangeText={setName} style={styles.input} autoFocus editable={!stamped} />
        <Text style={type.label}>Telefone (WhatsApp)</Text>
        <TextInput accessibilityLabel="Telefone" value={phone} onChangeText={(t) => setPhone(maskPhone(t))} keyboardType="phone-pad" placeholder="(85) 98888-7777" placeholderTextColor={colors.muted} style={styles.input} editable={!stamped} />

        <Pressable accessibilityRole="button" aria-expanded={showCar} onPress={() => setShowCar((v) => !v)} style={styles.more}>
          <Text style={styles.moreText}>Carro do cliente (opcional)</Text>
          {showCar ? <CaretUp size={18} color={colors.primary} weight="bold" /> : <CaretDown size={18} color={colors.primary} weight="bold" />}
        </Pressable>
        {showCar && (
          <Animated.View entering={softIn} style={{ gap: space.sm }}>
            <Text style={type.label}>Placa</Text>
            <TextInput accessibilityLabel="Placa" value={plate} onChangeText={(t) => setPlate(maskPlate(t))} autoCapitalize="characters" maxLength={7} style={styles.input} />
            <View style={styles.two}>
              <View style={{ flex: 1, gap: space.xs }}><Text style={type.label}>Marca</Text><TextInput accessibilityLabel="Marca" value={brand} onChangeText={setBrand} style={styles.input} /></View>
              <View style={{ flex: 1, gap: space.xs }}><Text style={type.label}>Modelo</Text><TextInput accessibilityLabel="Modelo" value={model} onChangeText={setModel} style={styles.input} /></View>
            </View>
          </Animated.View>
        )}
        {error ? <Animated.Text entering={softIn} style={styles.error} role="alert">{error}</Animated.Text> : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + space.sm }]}>
        <PillButton full label="Salvar cadastro" onPress={save} disabled={stamped} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.md, gap: space.sm, paddingBottom: 140 },
  input: { minHeight: 52, paddingHorizontal: space.md, borderRadius: radius.field, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, fontSize: 17, color: colors.text },
  more: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 52, paddingHorizontal: space.md, marginTop: space.xs, borderRadius: radius.field, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.border },
  moreText: { fontSize: 16, fontWeight: "700", color: colors.primary },
  two: { flexDirection: "row", gap: space.sm },
  error: { fontSize: 15, fontWeight: "600", color: colors.danger },
  sr: { position: "absolute", width: 1, height: 1, opacity: 0 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: space.md, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.hairline },
});
