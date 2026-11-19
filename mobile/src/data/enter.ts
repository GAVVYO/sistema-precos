import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Platform } from "react-native";
import type { ID } from "@core/domain/types";
import { playSwoop } from "@/components/swoop";
import { enterAs, rememberLastUser } from "@/data/store";

/**
 * Entrou (QR, digital, PIN ou e-mail do dono): vibração de sucesso, a águia
 * bate as asas e o gavião dá o rasante até o Pátio (decisão 76).
 */
export function enterApp(userId: ID, workshopId: ID, delay = 450, beforeEnter?: () => void) {
  if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  setTimeout(() => playSwoop(() => {
    // Conectar o celular só por baixo da cortina: a tela de desbloqueio não pisca antes do rasante.
    beforeEnter?.();
    enterAs(userId, workshopId);
    rememberLastUser(userId);
    router.replace("/");
  }), delay);
}
