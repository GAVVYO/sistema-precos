import { useEffect, useState } from "react";
import { Image, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

/**
 * Rasante do gavião (decisões 72 e 76), igual ao site: ao entrar, o gavião
 * mergulha do alto à direita em curva puxando a cortina azul da GAVYO; com a
 * tela coberta o app troca para o Pátio por baixo, e a cortina sai para a
 * esquerda. Tudo na thread de animação (Reanimated). Reduzir movimento: entra direto.
 */

type Job = { go: () => void };
let start: ((job: Job) => void) | null = null;
let reducedNow = false;

/** Dispara o rasante; `go` troca de tela quando a cortina cobre tudo. */
export function playSwoop(go: () => void) {
  if (!start || reducedNow) return go();
  start({ go });
}

const COVER = 820;
const REVEAL = 480;
const BLUE = "#1447c4";

export function SwoopHost() {
  const [job, setJob] = useState<Job | null>(null);
  const reduced = useReducedMotion();
  const { width: w, height: h } = useWindowDimensions();
  const t = useSharedValue(0);
  const out = useSharedValue(0);
  const size = Math.min(Math.max(w * 0.55, 180), 300);

  useEffect(() => {
    reducedNow = reduced;
    start = (j) => setJob(j);
    return () => { start = null; };
  }, [reduced]);

  useEffect(() => {
    if (!job) return;
    t.set(0);
    out.set(0);
    const reveal = () => {
      job.go();
      // A tela nova monta por baixo; então a cortina sai para a esquerda.
      setTimeout(() => out.set(withTiming(1, { duration: REVEAL, easing: Easing.bezier(0.65, 0, 0.35, 1) }, (fin) => { if (fin) scheduleOnRN(setJob, null); })), 220);
    };
    t.set(withTiming(1, { duration: COVER, easing: Easing.inOut(Easing.quad) }, (fin) => { if (fin) scheduleOnRN(reveal); }));
  }, [job, out, t]);

  // Curva do mergulho (Bézier cúbica): entra no alto à direita, desce perto do chão e sai pela esquerda.
  const P = [[w + size * 0.6, -size * 0.5], [w * 0.7, h * 0.8], [w * 0.25, h * 0.8], [-size * 0.9, h * 0.18]];
  const eagle = useAnimatedStyle(() => {
    const at = (e: number) => {
      const u = 1 - e;
      const k = [u * u * u, 3 * u * u * e, 3 * u * e * e, e * e * e];
      return [k[0] * P[0][0] + k[1] * P[1][0] + k[2] * P[2][0] + k[3] * P[3][0], k[0] * P[0][1] + k[1] * P[1][1] + k[2] * P[2][1] + k[3] * P[3][1]];
    };
    const e = t.get();
    const [x, y] = at(e);
    const [nx, ny] = at(Math.min(1, e + 0.01));
    const angle = (Math.atan2(ny - y, nx - x) * 180) / Math.PI + 180;
    return {
      opacity: e >= 1 ? 0 : 1,
      transform: [{ translateX: x - size / 2 }, { translateY: y - size * 0.32 }, { rotate: `${angle}deg` }, { scaleX: -1 }],
    };
  });
  // A borda da cortina é a cauda do gavião; depois, a cortina sai para a esquerda.
  const curtain = useAnimatedStyle(() => {
    const e = t.get();
    const u = 1 - e;
    const x = u * u * u * P[0][0] + 3 * u * u * e * P[1][0] + 3 * u * e * e * P[2][0] + e * e * e * P[3][0];
    const edge = e >= 1 ? 0 : Math.max(0, x + size * 0.15);
    return { transform: [{ translateX: edge - out.get() * w }] };
  });

  if (!job) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.curtain, curtain]}>
        <Image alt="" source={require("../../assets/brand/gavyo-nome.png")} style={[styles.word, { width: Math.min(w * 0.62, 320), height: Math.min(w * 0.62, 320) * (278 / 1030) }]} resizeMode="contain" />
      </Animated.View>
      <Animated.View style={[styles.eagleBox, { width: size, height: size * (284 / 437) }, eagle]}>
        {/* Contorno de luz: a mesma águia em branco, um pouco maior, atrás (não some no azul; funciona no Android). */}
        <Image alt="" source={require("../../assets/brand/gavyo-aguia.png")} style={[styles.eagle, styles.glow]} resizeMode="contain" />
        <Image alt="" source={require("../../assets/brand/gavyo-aguia.png")} style={[styles.eagle, StyleSheet.absoluteFill]} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  curtain: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center", backgroundColor: BLUE },
  word: { tintColor: "#ffffff", opacity: 0.95 },
  eagleBox: { position: "absolute", top: 0, left: 0, transformOrigin: "50% 32%" },
  eagle: { width: "100%", height: "100%" },
  glow: { tintColor: "#ffffff", transform: [{ scale: 1.07 }], opacity: 0.95 },
});
