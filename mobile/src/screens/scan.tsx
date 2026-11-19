import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Camera, X } from "phosphor-react-native";
import { useEffect, useRef, useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { readPairing } from "@core/services/pairing";
import { DomainError } from "@core/services/core";
import { PillButton } from "@/components/pill-button";
import { enterApp } from "@/data/enter";
import { connectDevice, useApp } from "@/data/store";
import { colors, space } from "@/theme";

const BOX = 250;

/**
 * Câmera que lê o QR (decisão 76). A moldura mostra onde apontar e uma linha
 * percorre a área (diz "estou lendo"). Leu: a moldura fica verde, vibra e entra.
 * QR errado ou vencido: aviso em frase simples e continua lendo.
 */
export function Scan() {
  const { db } = useApp();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const busy = useRef(false);
  const line = useSharedValue(0);
  const lineStyle = useAnimatedStyle(() => ({ transform: [{ translateY: line.get() * (BOX - 6) }] }));

  useEffect(() => {
    if (reduced) return;
    line.set(withRepeat(withSequence(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.quad) })), -1));
  }, [line, reduced]);

  const onRead = (data: string) => {
    if (busy.current || done) return;
    busy.current = true;
    try {
      const p = readPairing(db, data, new Date());
      setDone(true);
      if (p.kind === "person") { router.back(); enterApp(p.userId, p.workshopId, 350, () => connectDevice(p)); }
      else {
        connectDevice(p);
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => router.back(), 450);
      }
    } catch (e) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e instanceof DomainError ? e.message : "Não deu para ler o QR. Tente de novo.");
      // Dá tempo de ler o aviso antes de tentar de novo.
      setTimeout(() => { busy.current = false; }, 1800);
    }
  };

  const close = (
    <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={() => router.back()} style={[styles.close, { top: insets.top + space.sm }]} hitSlop={8}>
      <X size={24} color="#fff" weight="bold" />
    </Pressable>
  );

  if (!permission) return <View style={styles.page} />;
  if (!permission.granted) {
    return (
      <View style={[styles.page, styles.ask, { paddingTop: insets.top + space.xxl }]}>
        {close}
        <Camera size={56} color="#fff" weight="duotone" />
        <Text style={styles.askTitle} role="heading">Precisamos da câmera</Text>
        <Text style={styles.askText}>Ela serve só para ler o QR que conecta este celular à oficina.</Text>
        <PillButton full label={permission.canAskAgain ? "Permitir câmera" : "Abrir os ajustes"} onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())} />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={done ? undefined : ({ data }) => onRead(data)} />
      <View style={styles.shade} pointerEvents="none">
        <Text style={[styles.title, { marginTop: insets.top + 72 }]} role="heading">Aponte para o QR</Text>
        <Text style={styles.text}>Ele está no computador, em Pessoas.</Text>
        <View style={[styles.box, done && styles.boxOk]}>
          {(["tl", "tr", "bl", "br"] as const).map((c) => <View key={c} style={[styles.corner, styles[c], done && { borderColor: colors.success }]} />)}
          {!done && !reduced && <Animated.View style={[styles.line, lineStyle]} />}
        </View>
        {error && !done && <Animated.Text entering={FadeIn.duration(180)} style={styles.error} role="alert">{error}</Animated.Text>}
        {done && <Animated.Text entering={FadeIn.duration(180)} style={styles.ok} role="status">Conectado!</Animated.Text>}
      </View>
      {close}
    </View>
  );
}

const C = 34;
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#0b1530" },
  shade: { ...StyleSheet.absoluteFill, alignItems: "center", backgroundColor: "rgba(5, 12, 35, 0.35)", paddingHorizontal: space.lg },
  title: { fontSize: 26, fontWeight: "800", color: "#fff", textAlign: "center" },
  text: { marginTop: 6, fontSize: 16, color: "rgba(255,255,255,0.85)", textAlign: "center" },
  box: { width: BOX, height: BOX, marginTop: space.xxl, borderRadius: 28 },
  boxOk: { backgroundColor: "rgba(20, 122, 58, 0.18)" },
  corner: { position: "absolute", width: C, height: C, borderColor: "#fff" },
  tl: { top: 0, left: 0, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 24 },
  tr: { top: 0, right: 0, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 24 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: 24 },
  br: { bottom: 0, right: 0, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 24 },
  line: { position: "absolute", left: 14, right: 14, top: 3, height: 3, borderRadius: 2, backgroundColor: "#5b9bff", shadowColor: "#5b9bff", shadowOpacity: 1, shadowRadius: 8 },
  error: { marginTop: space.lg, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 14, overflow: "hidden", backgroundColor: colors.danger, fontSize: 15, fontWeight: "700", color: "#fff", textAlign: "center" },
  ok: { marginTop: space.lg, fontSize: 20, fontWeight: "800", color: "#fff" },
  close: { position: "absolute", right: space.md, width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.18)" },
  ask: { alignItems: "center", gap: space.md, paddingHorizontal: space.lg },
  askTitle: { fontSize: 24, fontWeight: "800", color: "#fff", textAlign: "center" },
  askText: { fontSize: 16, lineHeight: 23, color: "rgba(255,255,255,0.85)", textAlign: "center", marginBottom: space.sm },
});
