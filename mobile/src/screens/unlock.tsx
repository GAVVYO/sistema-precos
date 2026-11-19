import * as LocalAuthentication from "expo-local-authentication";
import { Fingerprint } from "phosphor-react-native";
import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ROLE_LABELS } from "@core/domain/permissions";
import { verifyPin } from "@core/services/admin";
import { Avatar } from "@/components/avatar";
import { Logo } from "@/components/logo";
import { PinPad } from "@/components/pin-pad";
import { enterApp } from "@/data/enter";
import { disconnectDevice, useApp } from "@/data/store";
import { colors, shadow, space, type } from "@/theme";
import { softIn } from "@/theme/motion";

const MAX_TRIES = 5;
const LOCK_MS = 30_000;
const clock = () => Date.now();

/**
 * Celular da própria pessoa (entrou pelo QR pessoal, decisão 76): abre já
 * pedindo a digital ou o rosto; sem isso (ou se falhar), o PIN de 4 números.
 */
export function Unlock({ workshopId, userId }: { workshopId: string; userId: string }) {
  const { db } = useApp();
  const insets = useSafeAreaInsets();
  const [bio, setBio] = useState<"checking" | "yes" | "no">("checking");
  const [pin, setPin] = useState("");
  const [errors, setErrors] = useState(0);
  const [tries, setTries] = useState(0);
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(clock);
  const [ok, setOk] = useState(false);
  const user = db.users.find((u) => u.id === userId);
  const m = db.memberships.find((x) => x.userId === userId && x.workshopId === workshopId);
  const lockedFor = until > now ? Math.ceil((until - now) / 1000) : 0;

  const success = useCallback(() => { setOk(true); enterApp(userId, workshopId); }, [userId, workshopId]);

  const askBio = useCallback(async () => {
    try {
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: "Abrir a GAVYO", cancelLabel: "Usar PIN", disableDeviceFallback: true });
      if (r.success) success();
    } catch { /* sem digital: segue no PIN */ }
  }, [success]);

  // Ao abrir: se o celular tem digital ou rosto cadastrado, já pede.
  useEffect(() => {
    let alive = true;
    (async () => {
      const has = Platform.OS !== "web" && (await LocalAuthentication.hasHardwareAsync().catch(() => false)) && (await LocalAuthentication.isEnrolledAsync().catch(() => false));
      if (!alive) return;
      setBio(has ? "yes" : "no");
      if (has) askBio();
    })();
    return () => { alive = false; };
  }, [askBio]);

  useEffect(() => {
    if (!lockedFor) return;
    const t = setInterval(() => setNow(clock()), 500);
    return () => clearInterval(t);
  }, [lockedFor]);

  const submit = (value: string) => {
    if (verifyPin(db, workshopId, userId, value)) return success();
    const n = tries + 1;
    setTries(n >= MAX_TRIES ? 0 : n);
    if (n >= MAX_TRIES) { const t = clock(); setUntil(t + LOCK_MS); setNow(t); }
    setErrors((e) => e + 1);
    setTimeout(() => setPin(""), 380);
  };

  const disconnect = () => {
    const go = () => disconnectDevice();
    if (Platform.OS === "web") return go();
    Alert.alert("Desconectar este celular?", "Para entrar de novo, vai precisar do QR do dono.", [{ text: "Cancelar", style: "cancel" }, { text: "Desconectar", style: "destructive", onPress: go }]);
  };

  if (!user || !m) return null;
  const left = MAX_TRIES - tries;
  const message = lockedFor ? `Muitas tentativas. Espere ${lockedFor} segundos.` : ok ? "Entrando…" : errors ? (left === 1 ? "PIN errado. Falta 1 tentativa." : `PIN errado. Faltam ${left} tentativas.`) : " ";

  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg }]} bounces={false}>
      <Logo flap={ok} height={36} />
      <Animated.View entering={softIn} style={styles.card}>
        <Avatar name={user.name} photo={user.photo} size={72} />
        <Text style={styles.title} role="heading">Olá, {user.name.split(" ")[0]}</Text>
        <Text style={styles.sub}>{ROLE_LABELS[m.role]} · {db.settings.find((s) => s.workshopId === workshopId)?.displayName}</Text>
        {bio === "yes" && !ok && (
          <Pressable accessibilityRole="button" onPress={askBio} style={styles.bio}>
            <Fingerprint size={30} color={colors.primary} weight="duotone" />
            <Text style={styles.bioText}>Usar a digital</Text>
          </Pressable>
        )}
        <Text style={styles.or}>{bio === "yes" ? "ou digite seu PIN" : "Digite seu PIN"}</Text>
        <PinPad pin={pin} onChange={setPin} onComplete={submit} errors={errors} ok={ok} disabled={!!lockedFor} message={message} />
      </Animated.View>
      <Pressable accessibilityRole="button" onPress={disconnect} hitSlop={8} style={styles.out}>
        <Text style={styles.outText}>Não é você? Desconectar este celular</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, alignItems: "center", gap: space.lg, paddingHorizontal: space.md, backgroundColor: colors.background },
  card: { width: "100%", maxWidth: 440, alignItems: "center", gap: space.xs, padding: space.lg, borderRadius: 26, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, ...shadow.card },
  title: { ...type.section, fontSize: 24, marginTop: space.xs },
  sub: { fontSize: 15, color: colors.muted },
  bio: { flexDirection: "row", alignItems: "center", gap: space.xs, minHeight: 52, paddingHorizontal: space.lg, marginTop: space.sm, borderRadius: 999, backgroundColor: colors.primarySoft },
  bioText: { fontSize: 17, fontWeight: "800", color: colors.primary },
  or: { marginTop: space.sm, fontSize: 15, fontWeight: "700", color: colors.muted },
  out: { minHeight: 44, justifyContent: "center" },
  outText: { fontSize: 15, fontWeight: "700", color: colors.muted, textDecorationLine: "underline" },
});
