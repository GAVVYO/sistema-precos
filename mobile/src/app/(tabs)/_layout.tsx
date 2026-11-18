import { Tabs } from "expo-router";
import { CalendarCheck, ClipboardText, UserCircle, UsersThree } from "phosphor-react-native";
import { useApp } from "@/data/store";
import { colors } from "@/theme";

/** Abas: recepção Hoje · Serviços · Pessoas · Conta; mecânico Seus carros · Conta (regras §4). */
export default function TabsLayout() {
  const { membership } = useApp();
  const mechanic = membership.role === "mechanic";
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.hairline, height: 64, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "700" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: mechanic ? "Seus carros" : "Hoje", tabBarIcon: ({ color, focused }) => <CalendarCheck size={26} color={color as string} weight={focused ? "duotone" : "regular"} /> }} />
      <Tabs.Screen name="servicos" options={{ title: "Serviços", href: mechanic ? null : undefined, tabBarIcon: ({ color, focused }) => <ClipboardText size={26} color={color as string} weight={focused ? "duotone" : "regular"} /> }} />
      <Tabs.Screen name="pessoas" options={{ title: "Pessoas", href: mechanic ? null : undefined, tabBarIcon: ({ color, focused }) => <UsersThree size={26} color={color as string} weight={focused ? "duotone" : "regular"} /> }} />
      <Tabs.Screen name="conta" options={{ title: "Conta", tabBarIcon: ({ color, focused }) => <UserCircle size={26} color={color as string} weight={focused ? "duotone" : "regular"} /> }} />
    </Tabs>
  );
}
