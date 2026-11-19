import { router } from "expo-router";
import { Eye, EyeSlash, QrCode } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeInDown, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DEMO_OWNER_ID, DEMO_OWNER_PASSWORD, DEMO_WORKSHOP_ID } from "@core/demo/seed";
import { checkEmail, checkPassword, ownedWorkshops } from "@core/services/auth";
import { createPairing, readPairing } from "@core/services/pairing";
import { DomainError } from "@core/services/core";
import { Logo } from "@/components/logo";
import { PillButton } from "@/components/pill-button";
import { enterApp } from "@/data/enter";
import { connectDevice, useApp } from "@/data/store";
import { colors, radius, shadow, space, type } from "@/theme";
import { EASE_OUT } from "@/theme/motion";

/**
 * Celular ainda não ligado à oficina (decisão 76): um botão grande, "Ler QR".
 * O QR aparece no computador, em Pessoas. O dono tem a reserva de e-mail e
 * senha (a mesma que a GAVYO entregou).
 */
export function Welcome() {
  const { db } = useApp();
  const insets = useSafeAreaInsets();
  const [owner, setOwner] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ownerEnter = () => {
    setError(null);
    try {
      const r = checkEmail(db, email);
      if (r.kind === "unknown") return setError("Não achamos esse e-mail.");
      if (r.kind === "not-owner") return setError("Esse e-mail é de funcionário. Peça ao dono o QR do seu celular.");
      if (!checkPassword(db, r.userId, password)) return setError("Senha errada.");
      const ws = ownedWorkshops(db, r.userId)[0];
      setBusy(true);
      connectDevice({ kind: "person", workshopId: ws, userId: r.userId });
      enterApp(r.userId, ws, 120);
    } catch (e) {
      setError(e instanceof DomainError ? e.message : "Digite um e-mail. Ex.: joao@suaoficina.com");
    }
  };

  /** Demonstração sem computador: gera aqui o mesmo QR que o dono geraria. */
  const demo = (kind: "person" | "device") => {
    const ctx = { workshopId: DEMO_WORKSHOP_ID, userId: DEMO_OWNER_ID, now: new Date() };
    const ju = db.memberships.find((m) => m.userId === "u-juliana" && m.workshopId === DEMO_WORKSHOP_ID)!;
    const { code } = createPairing(db, ctx, kind === "person" ? { kind, membershipId: ju.id } : { kind });
    const p = readPairing(db, code, new Date());
    setBusy(true);
    connectDevice(p);
    // Aparelho da oficina: a própria tela de entrada vira "Quem está entrando?".
    if (p.kind === "person") enterApp(p.userId, p.workshopId, 120);
  };

  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.lg }]} keyboardShouldPersistTaps="handled">
      <Logo height={40} />
      <Animated.View entering={FadeInDown.duration(420).delay(200).easing(EASE_OUT)} layout={LinearTransition.duration(260)} style={styles.card}>
        <View style={styles.qrBadge}><QrCode size={40} color={colors.primary} weight="duotone" /></View>
        <Text style={styles.title} role="heading">Conecte este celular à oficina</Text>
        <Text style={styles.sub}>Peça ao dono para abrir <Text style={styles.strong}>Pessoas</Text> no computador e mostrar o QR do seu celular.</Text>
        <PillButton full label="Ler QR" icon={<QrCode size={24} color={colors.primaryFg} weight="bold" />} onPress={() => router.push("/conectar")} disabled={busy} />

        {!owner ? (
          <Pressable accessibilityRole="button" onPress={() => setOwner(true)} style={styles.link} hitSlop={8}>
            <Text style={styles.linkText}>Sou o dono: entrar com e-mail e senha</Text>
          </Pressable>
        ) : (
          <Animated.View entering={FadeIn.duration(220)} style={styles.form}>
            <Text style={styles.label} nativeID="lbl-email">E-mail</Text>
            <TextInput accessibilityLabelledBy="lbl-email" aria-label="E-mail" style={styles.input} value={email} onChangeText={(v) => { setEmail(v.replace(/\s/g, "").toLowerCase()); setError(null); }} autoCapitalize="none" autoComplete="email" textContentType="username" keyboardType="email-address" returnKeyType="next" />
            <Text style={styles.label} nativeID="lbl-senha">Senha</Text>
            <View>
              <TextInput accessibilityLabelledBy="lbl-senha" aria-label="Senha" style={[styles.input, { paddingRight: 52 }]} value={password} onChangeText={(v) => { setPassword(v); setError(null); }} secureTextEntry={!show} autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={ownerEnter} />
              <Pressable accessibilityRole="button" accessibilityLabel={show ? "Esconder senha" : "Mostrar senha"} onPress={() => setShow(!show)} style={styles.eye} hitSlop={6}>
                {show ? <EyeSlash size={22} color={colors.muted} weight="duotone" /> : <Eye size={22} color={colors.muted} weight="duotone" />}
              </Pressable>
            </View>
            {error && <Text style={styles.error} role="alert">{error}</Text>}
            <PillButton full variant="secondary" label="Entrar" onPress={ownerEnter} disabled={!email || !password || busy} />
            <Text style={styles.hint}>Esqueceu a senha? Fale com a GAVYO.</Text>
          </Animated.View>
        )}
      </Animated.View>

      <View style={styles.demo}>
        <Text style={styles.demoText}>Demonstração sem computador:</Text>
        <View style={styles.demoRow}>
          <PillButton variant="secondary" label="Celular da Juliana" onPress={() => demo("person")} disabled={busy} />
          <PillButton variant="secondary" label="Aparelho da oficina" onPress={() => demo("device")} disabled={busy} />
        </View>
        <Text style={styles.demoText}>Dono: carlos@oficinamodelo.demo · senha {DEMO_OWNER_PASSWORD}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, alignItems: "center", gap: space.lg, paddingHorizontal: space.md, backgroundColor: colors.background },
  card: { width: "100%", maxWidth: 440, alignItems: "stretch", gap: space.sm, padding: space.lg, borderRadius: 26, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, ...shadow.card },
  qrBadge: { alignSelf: "center", width: 76, height: 76, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft, marginBottom: space.xs },
  title: { ...type.section, fontSize: 22, textAlign: "center" },
  sub: { fontSize: 16, lineHeight: 23, color: colors.muted, textAlign: "center", marginBottom: space.xs },
  strong: { fontWeight: "800", color: colors.text },
  link: { alignSelf: "center", minHeight: 44, justifyContent: "center", marginTop: space.xxs },
  linkText: { fontSize: 15, fontWeight: "700", color: colors.primary, textDecorationLine: "underline" },
  form: { gap: space.xs, marginTop: space.xs },
  label: { fontSize: 15, fontWeight: "700", color: colors.text },
  input: { height: 52, paddingHorizontal: 14, borderRadius: radius.field, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, fontSize: 17, color: colors.text },
  eye: { position: "absolute", right: 4, top: 4, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  error: { fontSize: 15, fontWeight: "700", color: colors.danger },
  hint: { fontSize: 14, color: colors.muted, textAlign: "center" },
  demo: { width: "100%", maxWidth: 440, gap: space.xs, padding: space.md, borderRadius: radius.card, backgroundColor: colors.warningSoft },
  demoRow: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  demoText: { fontSize: 13, color: "#7a3a06" },
});
