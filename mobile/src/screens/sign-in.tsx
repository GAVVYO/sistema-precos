import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { ArrowLeft, Backspace, Buildings } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ROLE_LABELS } from "@core/domain/permissions";
import type { ID } from "@core/domain/types";
import { DEMO_PIN, verifyPin } from "@core/services/admin";
import { Avatar } from "@/components/avatar";
import { Logo } from "@/components/logo";
import { PressScale } from "@/components/press-scale";
import { enterAs, setDeviceWorkshop, useApp } from "@/data/store";
import { colors, radius, shadow, space, type } from "@/theme";
import { softIn } from "@/theme/motion";

const MAX_TRIES = 5;
const LOCK_MS = 30_000;
/** Relógio fora do componente: as chamadas acontecem só em toques, nunca na renderização. */
const clock = () => Date.now();
const haptic = (fn: () => Promise<void>) => { if (Platform.OS !== "web") fn(); };

/**
 * Entrada (decisão 70), igual ao site: a águia pousa; quem está entrando toca no
 * próprio nome e digita o PIN de 4 números. Errou: as bolinhas balançam e vibra;
 * 5 erros travam 30 s. Acertou: verde, a águia bate as asas e abre o app.
 */
export function SignIn() {
  const { db, workshopId } = useApp();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [choosingWs, setChoosingWs] = useState(false);
  const [userId, setUserId] = useState<ID | null>(null);
  const [pin, setPin] = useState("");
  const [wrong, setWrong] = useState(false);
  const [ok, setOk] = useState(false);
  const [tries, setTries] = useState<Record<string, { n: number; until: number }>>({});
  const [now, setNow] = useState(clock);
  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.get() }] }));

  const settings = db.settings.find((s) => s.workshopId === workshopId);
  const people = db.memberships
    .filter((m) => m.workshopId === workshopId && m.active)
    .map((m) => ({ m, u: db.users.find((x) => x.id === m.userId)! }))
    .sort((a, b) => a.u.name.localeCompare(b.u.name, "pt-BR"));
  const person = people.find((x) => x.u.id === userId);
  const lock = userId ? tries[userId] : undefined;
  const lockedFor = lock && lock.until > now ? Math.ceil((lock.until - now) / 1000) : 0;

  useEffect(() => {
    if (!lockedFor) return;
    const t = setInterval(() => setNow(clock()), 500);
    return () => clearInterval(t);
  }, [lockedFor]);

  const submit = (value: string) => {
    if (!userId) return;
    if (verifyPin(db, workshopId, userId, value)) {
      setOk(true);
      haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      setTimeout(() => { enterAs(userId, workshopId); router.replace("/"); }, reduced ? 0 : 650);
      return;
    }
    const n = (tries[userId]?.n ?? 0) + 1;
    const t = clock();
    setTries({ ...tries, [userId]: { n: n >= MAX_TRIES ? 0 : n, until: n >= MAX_TRIES ? t + LOCK_MS : 0 } });
    setNow(t);
    setWrong(true);
    haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
    if (!reduced) shakeX.set(withSequence(withTiming(-10, { duration: 50 }), withTiming(10, { duration: 70 }), withTiming(-8, { duration: 70 }), withTiming(6, { duration: 60 }), withTiming(0, { duration: 50 })));
    setTimeout(() => setPin(""), 380);
  };

  const press = (d: string) => {
    if (ok || lockedFor || pin.length >= 4) return;
    haptic(() => Haptics.selectionAsync());
    const next = pin + d;
    setPin(next);
    setWrong(false);
    if (next.length === 4) setTimeout(() => submit(next), 120);
  };

  const left = MAX_TRIES - (userId ? tries[userId]?.n ?? 0 : 0);
  const message = lockedFor ? `Muitas tentativas. Espere ${lockedFor} segundos.` : ok ? "Entrando…" : wrong ? `PIN errado. Faltam ${left} tentativas.` : " ";

  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg }]} bounces={false}>
      <Logo flap={ok} height={40} />

      <Animated.View entering={softIn} style={styles.card}>
        {choosingWs ? (
          <>
            <Text style={styles.title} role="heading">Qual oficina usa este celular?</Text>
            <Text style={styles.sub}>Na versão real, o dono entra uma vez com e-mail e senha.</Text>
            {db.workshops.map((w) => {
              const on = w.id === workshopId;
              return (
                <PressScale key={w.id} scale={0.98} accessibilityRole="radio" aria-checked={on} onPress={() => { setDeviceWorkshop(w.id); setChoosingWs(false); setUserId(null); }} style={[styles.shop, on && styles.shopOn]}>
                  <Buildings size={24} color={on ? colors.primary : colors.muted} weight="duotone" />
                  <Text style={[styles.shopText, on && { color: colors.primary }]}>{db.settings.find((s) => s.workshopId === w.id)?.displayName ?? w.name}</Text>
                </PressScale>
              );
            })}
          </>
        ) : !person ? (
          <>
            <Text style={styles.title} role="heading">Quem está entrando?</Text>
            <Text style={styles.sub}>
              {settings?.displayName} ·{" "}
              <Text style={styles.link} accessibilityRole="link" onPress={() => setChoosingWs(true)}>Trocar de oficina</Text>
            </Text>
            <View style={styles.people}>
              {people.map(({ m, u }) => (
                <PressScale key={m.id} containerStyle={styles.personCell} scale={0.96} accessibilityRole="button" accessibilityLabel={`${u.name}, ${ROLE_LABELS[m.role]}`} onPress={() => { setUserId(u.id); setPin(""); setWrong(false); setOk(false); }} style={styles.person}>
                  <Avatar name={u.name} photo={u.photo} size={60} />
                  <Text style={styles.personName} numberOfLines={2}>{u.name.split(" ").slice(0, 2).join(" ")}</Text>
                  <Text style={styles.personRole}>{ROLE_LABELS[m.role]}</Text>
                </PressScale>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.pinBox}>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => { setUserId(null); setPin(""); }} style={styles.back}>
              <ArrowLeft size={18} color={colors.primary} weight="bold" />
              <Text style={styles.backText}>Não é você?</Text>
            </Pressable>
            <Avatar name={person.u.name} photo={person.u.photo} size={64} />
            <Text style={styles.title} role="heading">Olá, {person.u.name.split(" ")[0]}. Digite seu PIN</Text>
            <Animated.View style={[styles.dots, shakeStyle]} role="img" accessibilityLabel={`${pin.length} de 4 números digitados`}>
              {[0, 1, 2, 3].map((i) => <View key={i} style={[styles.dot, i < pin.length && styles.dotOn, ok && styles.dotOk]} />)}
            </Animated.View>
            <Text style={[styles.msg, ok && { color: colors.success }]} accessibilityLiveRegion="polite" role="alert">{message}</Text>
            <View style={styles.pad}>
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((k, i) =>
                k === "" ? <View key={i} style={[styles.key, styles.keyGhost]} /> : k === "del" ? (
                  <Pressable key={i} accessibilityRole="button" accessibilityLabel="Apagar" disabled={!pin || ok} onPress={() => setPin(pin.slice(0, -1))} style={[styles.key, styles.keyGhost]}>
                    <Backspace size={28} color={colors.muted} weight="duotone" />
                  </Pressable>
                ) : (
                  <PressScale key={i} scale={0.92} accessibilityRole="button" accessibilityLabel={k} disabled={!!lockedFor || ok} onPress={() => press(k)} style={[styles.key, lockedFor || ok ? styles.keyOff : null]}>
                    <Text style={styles.keyText}>{k}</Text>
                  </PressScale>
                ),
              )}
            </View>
            <Text style={styles.help}>Esqueceu o PIN? Peça ao dono para trocar no computador, em Pessoas › Funcionários.</Text>
          </View>
        )}
      </Animated.View>

      <Text style={styles.demo}>Demonstração: dados fictícios. PIN de todos: <Text style={{ fontWeight: "800" }}>{DEMO_PIN}</Text>.</Text>
    </ScrollView>
  );
}

const KEY = 74;
const styles = StyleSheet.create({
  page: { flexGrow: 1, alignItems: "center", gap: space.lg, paddingHorizontal: space.md, backgroundColor: colors.background },
  card: { width: "100%", maxWidth: 440, gap: space.sm, padding: space.lg, borderRadius: 26, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, ...shadow.card },
  title: { ...type.section, fontSize: 22, textAlign: "center" },
  sub: { fontSize: 15, color: colors.muted, textAlign: "center", marginBottom: space.xs },
  link: { color: colors.primary, fontWeight: "700", textDecorationLine: "underline" },
  people: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.sm },
  personCell: { width: "31%" },
  person: { alignItems: "center", gap: 4, minHeight: 132, paddingVertical: space.md, paddingHorizontal: 6, borderRadius: radius.card, backgroundColor: colors.background },
  personName: { marginTop: 4, fontSize: 15, lineHeight: 19, fontWeight: "800", color: colors.text, textAlign: "center" },
  personRole: { fontSize: 13, color: colors.muted },
  shop: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 60, paddingHorizontal: space.md, borderRadius: 18, borderWidth: 1.5, borderColor: colors.border },
  shopOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  shopText: { fontSize: 17, fontWeight: "700", color: colors.text },
  pinBox: { alignItems: "center", gap: space.sm },
  back: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40 },
  backText: { fontSize: 15, fontWeight: "700", color: colors.primary },
  dots: { flexDirection: "row", gap: 18, paddingVertical: 6 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "#9aa6b6" },
  dotOn: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  dotOk: { backgroundColor: colors.success, borderColor: colors.success },
  msg: { minHeight: 20, fontSize: 15, fontWeight: "700", color: colors.danger, textAlign: "center" },
  pad: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", width: KEY * 3 + 22 * 2, columnGap: 22, rowGap: 12 },
  key: { width: KEY, height: KEY, borderRadius: KEY / 2, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  keyOff: { opacity: 0.4 },
  keyGhost: { backgroundColor: "transparent" },
  keyText: { fontSize: 30, fontWeight: "600", color: colors.text, fontVariant: ["tabular-nums"] },
  help: { fontSize: 14, color: colors.muted, textAlign: "center", marginTop: space.xs },
  demo: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.warningSoft, fontSize: 13, color: "#7a3a06", textAlign: "center" },
});
