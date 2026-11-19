import "@/data/polyfills";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SwoopHost } from "@/components/swoop";
import { loadDevice } from "@/data/store";
import { ToastHost } from "@/data/toast";
import { colors } from "@/theme";

/** Pilha nativa: abas na base; ficha empilhada; tarefas com passos como janela que sobe (regras §4). */
export default function RootLayout() {
  // Lê como este celular está ligado à oficina (QR pessoal, aparelho da oficina ou nada).
  useEffect(() => { loadDevice(); }, []);
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
        <Stack.Screen name="entrar" options={{ headerShown: false, gestureEnabled: false, animation: "fade" }} />
        <Stack.Screen name="conectar" options={{ headerShown: false, presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: "fade" }} />
        <Stack.Screen name="servico/[id]" options={{ title: "Serviço" }} />
        <Stack.Screen name="novo-servico" options={{ title: "Novo serviço", presentation: "modal" }} />
        <Stack.Screen name="receber/[id]" options={{ title: "Receber", presentation: "modal" }} />
        <Stack.Screen name="cliente/[id]" options={{ title: "Cliente" }} />
        <Stack.Screen name="novo-cliente" options={{ title: "Novo cliente", presentation: "modal" }} />
      </Stack>
      <ToastHost />
      <SwoopHost />
    </>
  );
}
