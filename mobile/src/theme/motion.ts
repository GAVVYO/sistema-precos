import { cubicBezier, Easing, FadeInDown, LinearTransition, ReduceMotion, SlideInLeft, SlideInRight, FadeOutDown } from "react-native-reanimated";

/**
 * Movimento do app (skill expo-animation): curvas fortes de saída, nada de ease-in,
 * tudo abaixo de 300 ms e respeitando "reduzir movimento" do sistema.
 */
export const CSS_EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

/** Toque: encolhe 3% em 120 ms (usado dezenas de vezes por dia: quase imperceptível). */
export const pressTransition = {
  transitionProperty: "transform",
  transitionDuration: "120ms",
  transitionTimingFunction: CSS_EASE_OUT,
} as const;

/** Entrada em cascata (abrir o app): 250 ms, 40 ms entre itens. */
export const enterStagger = (index: number) => FadeInDown.duration(250).delay(index * 40).easing(EASE_OUT).reduceMotion(ReduceMotion.System);

/** Lista que se reorganiza quando um carro muda de etapa. */
export const reflow = LinearTransition.duration(240).easing(EASE_IN_OUT).reduceMotion(ReduceMotion.System);

/** Passos do Novo serviço: entra pelo lado para onde se está indo. */
export const stepForward = SlideInRight.duration(260).easing(EASE_OUT).reduceMotion(ReduceMotion.System);
export const stepBack = SlideInLeft.duration(260).easing(EASE_OUT).reduceMotion(ReduceMotion.System);

/** Aviso que sobe de baixo; sai 20% mais rápido do que entra. */
export const toastIn = FadeInDown.duration(260).easing(EASE_OUT).reduceMotion(ReduceMotion.System);
export const toastOut = FadeOutDown.duration(200).easing(EASE_OUT).reduceMotion(ReduceMotion.System);
export const softIn = FadeInDown.duration(220).easing(EASE_OUT).reduceMotion(ReduceMotion.System);
