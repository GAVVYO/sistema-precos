import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "@/theme";

/** Pilha nativa: abas na base; ficha empilhada; tarefas com passos como janela que sobe (regras §4). */
export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text, fontWeight: "700" },
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerBackTitle: "Voltar",
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="servico/[id]" options={{ title: "Serviço" }} />
        <Stack.Screen name="novo-servico" options={{ title: "Novo serviço", presentation: "modal" }} />
        <Stack.Screen name="receber/[id]" options={{ title: "Receber", presentation: "modal" }} />
      </Stack>
    </>
  );
}
