import { ArrowCounterClockwise, Desktop, IdentificationBadge, Wrench } from "phosphor-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ROLE_LABELS } from "@core/domain/permissions";
import { Avatar } from "@/components/avatar";
import { PillButton } from "@/components/pill-button";
import { enterAs, resetDemo, useApp } from "@/data/store";
import { colors, radius, shadow, space, type } from "@/theme";

/** Conta: quem está usando, trocar de pessoa na demonstração, restaurar. */
export function Account() {
  const { view, user, membership } = useApp();
  const insets = useSafeAreaInsets();
  const options = view.memberships.filter((m) => m.active && (m.role === "receptionist" || m.role === "mechanic"));
  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + space.md }]}>
      <Text style={type.title}>Conta</Text>
      <View style={styles.card}>
        <Avatar name={user.name} photo={user.photo} size={64} />
        <View style={{ flex: 1 }}>
          <Text style={type.section}>{user.name}</Text>
          <Text style={type.caption}>{ROLE_LABELS[membership.role]} · {view.settings?.displayName}</Text>
        </View>
      </View>

      <Text style={[type.label, styles.group]}>Entrar como (demonstração)</Text>
      <View style={styles.list}>
        {options.map((m) => {
          const u = view.users.find((x) => x.id === m.userId)!;
          const on = u.id === user.id;
          return (
            <Pressable key={m.id} role="radio" aria-checked={on} onPress={() => enterAs(u.id)} style={[styles.option, on && styles.optionOn]}>
              {m.role === "mechanic" ? <Wrench size={24} color={on ? colors.primary : colors.muted} weight="duotone" /> : <IdentificationBadge size={24} color={on ? colors.primary : colors.muted} weight="duotone" />}
              <View style={{ flex: 1 }}>
                <Text style={type.bodyStrong}>{u.name}</Text>
                <Text style={type.caption}>{ROLE_LABELS[m.role]}</Text>
              </View>
              <View style={[styles.radio, on && styles.radioOn]} />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.note}>
        <Desktop size={22} color={colors.muted} weight="duotone" />
        <Text style={[type.caption, { flex: 1 }]}>Financeiro, estoque, relatórios e funcionários continuam no computador.</Text>
      </View>
      <PillButton label="Restaurar demonstração" variant="secondary" icon={<ArrowCounterClockwise size={18} color={colors.text} weight="bold" />} onPress={resetDemo} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.md, gap: space.md, paddingBottom: space.xxl * 2 },
  card: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, borderRadius: radius.card, backgroundColor: colors.surface, ...shadow.card },
  group: { marginTop: space.sm },
  list: { gap: space.xs },
  option: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 64, paddingHorizontal: space.md, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.hairline },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border },
  radioOn: { borderColor: colors.primary, borderWidth: 7 },
  note: { flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.md, borderRadius: radius.card, backgroundColor: colors.track },
});
