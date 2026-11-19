import { ArrowLeft } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ROLE_LABELS } from "@core/domain/permissions";
import type { ID } from "@core/domain/types";
import { DEMO_PIN, verifyPin } from "@core/services/admin";
import { Avatar } from "@/components/avatar";
import { Logo } from "@/components/logo";
import { PinPad } from "@/components/pin-pad";
import { PressScale } from "@/components/press-scale";
import { enterApp } from "@/data/enter";
import { useApp } from "@/data/store";
import { colors, radius, shadow, space, type } from "@/theme";
import { enterStagger, softIn } from "@/theme/motion";

const MAX_TRIES = 5;
const LOCK_MS = 30_000;
/** Relógio fora do componente: as chamadas acontecem só em toques, nunca na renderização. */
const clock = () => Date.now();

/**
 * Aparelho da oficina (decisão 76: QR do balcão, várias pessoas): "Quem está
 * entrando?" + PIN, igual ao site. Quem entrou por último já vem aberto.
 */
export function SignIn({ workshopId, lastUserId }: { workshopId: ID; lastUserId?: ID }) {
  const { db } = useApp();
  const insets = useSafeAreaInsets();
  const [chosen, setUserId] = useState<ID | null | undefined>(undefined);
  const [pin, setPin] = useState("");
  const [errors, setErrors] = useState(0);
  const [ok, setOk] = useState(false);
  const [tries, setTries] = useState<Record<string, { n: number; until: number }>>({});
  const [now, setNow] = useState(clock);

  const settings = db.settings.find((s) => s.workshopId === workshopId);
  const people = db.memberships
    .filter((m) => m.workshopId === workshopId && m.active)
    .map((m) => ({ m, u: db.users.find((x) => x.id === m.userId)! }))
    .sort((a, b) => a.u.name.localeCompare(b.u.name, "pt-BR"));
  const userId = chosen !== undefined ? chosen : people.some((x) => x.u.id === lastUserId) ? lastUserId! : null;
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
    if (verifyPin(db, workshopId, userId, value)) { setOk(true); enterApp(userId, workshopId); return; }
    const n = (tries[userId]?.n ?? 0) + 1;
    const t = clock();
    setTries({ ...tries, [userId]: { n: n >= MAX_TRIES ? 0 : n, until: n >= MAX_TRIES ? t + LOCK_MS : 0 } });
    setNow(t);
    setErrors((e) => e + 1);
    setTimeout(() => setPin(""), 380);
  };

  const left = MAX_TRIES - (userId ? tries[userId]?.n ?? 0 : 0);
  const message = lockedFor ? `Muitas tentativas. Espere ${lockedFor} segundos.` : ok ? "Entrando…" : errors ? (left === 1 ? "PIN errado. Falta 1 tentativa." : `PIN errado. Faltam ${left} tentativas.`) : " ";

  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg }]} bounces={false}>
      <Logo flap={ok} height={40} />

      <Animated.View entering={softIn} style={styles.card}>
        {!person ? (
          <>
            <Text style={styles.title} role="heading">Quem está entrando?</Text>
            <Text style={styles.sub}>{settings?.displayName}</Text>
            <View style={styles.people}>
              {people.map(({ m, u }, i) => (
                <Animated.View key={m.id} entering={enterStagger(i)} style={styles.personCell}>
                  <PressScale scale={0.96} accessibilityRole="button" accessibilityLabel={`${u.name}, ${ROLE_LABELS[m.role]}`} onPress={() => { setUserId(u.id); setPin(""); setErrors(0); setOk(false); }} style={styles.person}>
                    <Avatar name={u.name} photo={u.photo} size={60} />
                    <Text style={styles.personName} numberOfLines={2}>{u.name.split(" ").slice(0, 2).join(" ")}</Text>
                    <Text style={styles.personRole}>{ROLE_LABELS[m.role]}</Text>
                  </PressScale>
                </Animated.View>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.pinBox}>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => { setUserId(null); setPin(""); setErrors(0); }} style={styles.back} disabled={ok}>
              <ArrowLeft size={18} color={colors.primary} weight="bold" />
              <Text style={styles.backText}>Não é você?</Text>
            </Pressable>
            <Avatar name={person.u.name} photo={person.u.photo} size={64} />
            <Text style={styles.title} role="heading">Olá, {person.u.name.split(" ")[0]}. Digite seu PIN</Text>
            <PinPad pin={pin} onChange={setPin} onComplete={submit} errors={errors} ok={ok} disabled={!!lockedFor} message={message} />
            <Text style={styles.help}>Esqueceu o PIN? Peça ao dono para trocar no computador, em Pessoas.</Text>
          </View>
        )}
      </Animated.View>

      <Text style={styles.demo}>Demonstração: PIN de todos <Text style={{ fontWeight: "800" }}>{DEMO_PIN}</Text>.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, alignItems: "center", gap: space.lg, paddingHorizontal: space.md, backgroundColor: colors.background },
  card: { width: "100%", maxWidth: 440, gap: space.sm, padding: space.lg, borderRadius: 26, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, ...shadow.card },
  title: { ...type.section, fontSize: 22, textAlign: "center" },
  sub: { fontSize: 15, color: colors.muted, textAlign: "center", marginBottom: space.xs },
  people: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.sm },
  personCell: { width: "31%" },
  person: { alignItems: "center", gap: 4, minHeight: 132, paddingVertical: space.md, paddingHorizontal: 6, borderRadius: radius.card, backgroundColor: colors.background },
  personName: { marginTop: 4, fontSize: 15, lineHeight: 19, fontWeight: "800", color: colors.text, textAlign: "center" },
  personRole: { fontSize: 13, color: colors.muted },
  pinBox: { alignItems: "center", gap: space.sm },
  back: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40 },
  backText: { fontSize: 15, fontWeight: "700", color: colors.primary },
  help: { fontSize: 14, color: colors.muted, textAlign: "center", marginTop: space.xs },
  demo: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.warningSoft, fontSize: 13, color: "#7a3a06", textAlign: "center" },
});
