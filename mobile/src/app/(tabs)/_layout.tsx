import { Tabs } from "expo-router";
import { Car, House, UserCircle, UsersThree } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/data/store";
import { colors } from "@/theme";

/** Abas: recepção Hoje · Serviços · Pessoas · Conta; mecânico Seus carros · Conta (regras §4). */
export default function TabsLayout() {
  const { membership } = useApp();
  const mechanic = membership.role === "mechanic";
  // A barra desconta a área dos botões do celular (Android) e da barra de início (iPhone).
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.hairline, height: 64 + insets.bottom, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 8) },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "700" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: mechanic ? "Seus carros" : "Início", tabBarIcon: ({ color, focused }) => <House size={26} color={color as string} weight={focused ? "duotone" : "regular"} /> }} />
      <Tabs.Screen name="servicos" options={{ title: "Carros", href: mechanic ? null : undefined, tabBarIcon: ({ color, focused }) => <Car size={26} color={color as string} weight={focused ? "duotone" : "regular"} /> }} />
      <Tabs.Screen name="pessoas" options={{ title: "Pessoas", href: mechanic ? null : undefined, tabBarIcon: ({ color, focused }) => <UsersThree size={26} color={color as string} weight={focused ? "duotone" : "regular"} /> }} />
      <Tabs.Screen name="conta" options={{ title: "Conta", tabBarIcon: ({ color, focused }) => <UserCircle size={26} color={color as string} weight={focused ? "duotone" : "regular"} /> }} />
    </Tabs>
  );
}
