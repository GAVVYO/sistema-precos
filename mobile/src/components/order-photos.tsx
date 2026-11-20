import { Camera, ImageSquare, Trash, X } from "phosphor-react-native";
import { useState } from "react";
import { Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PhotoStage, ServiceOrder } from "@core/domain/types";
import { formatDateTime } from "@core/lib/format";
import { deleteOrderPhoto, moveOrderPhoto, PHOTO_STAGE_LABEL, PHOTO_STAGES, photosOf, stageForStatus } from "@core/services/photos";
import { PillButton } from "@/components/pill-button";
import { PressScale } from "@/components/press-scale";
import { capturePhoto } from "@/data/photos";
import { act, useApp } from "@/data/store";
import { showToast } from "@/data/toast";
import { colors, radius, space, type } from "@/theme";

/**
 * Fotos do carro na ficha do serviço (decisão 87): Chegou · Durante · Pronto.
 * A etapa vem escolhida pela situação do serviço; "Tirar foto" abre a câmera.
 * Tocar numa foto abre em tela cheia, com mudar o momento e apagar.
 */
export function OrderPhotos({ order }: { order: ServiceOrder }) {
  const { view, userOf } = useApp();
  const insets = useSafeAreaInsets();
  const all = photosOf(view, order.id);
  const [stage, setStage] = useState<PhotoStage>(stageForStatus(order.status));
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = all.filter((p) => p.stage === stage);
  const current = shown.find((p) => p.id === open);
  const canAdd = !order.cancelledAt;

  const take = async (from: "camera" | "library") => {
    setBusy(true);
    try { await capturePhoto(order.id, stage, from); } finally { setBusy(false); }
  };
  const remove = (id: string) => {
    const go = () => { const r = act((db, ctx) => deleteOrderPhoto(db, ctx, id)); if (!r.ok) showToast(r.message); else { showToast("Foto apagada."); setOpen(null); } };
    if (Platform.OS === "web") return go();
    Alert.alert("Apagar esta foto?", "Ela sai do serviço.", [{ text: "Cancelar", style: "cancel" }, { text: "Apagar", style: "destructive", onPress: go }]);
  };

  return (
    <View style={styles.box}>
      <Text style={type.section} role="heading">Fotos do carro {all.length ? `(${all.length})` : ""}</Text>
      <View style={styles.stages} role="tablist">
        {PHOTO_STAGES.map((s) => {
          const on = s.value === stage;
          const n = all.filter((p) => p.stage === s.value).length;
          return (
            <Pressable key={s.value} role="tab" aria-selected={on} onPress={() => setStage(s.value)} style={[styles.stage, on && styles.stageOn]}>
              <Text style={[styles.stageText, on && styles.stageTextOn]}>{s.label}{n ? ` · ${n}` : ""}</Text>
            </Pressable>
          );
        })}
      </View>

      {shown.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
          {shown.map((p, i) => (
            <Animated.View key={p.id} entering={ZoomIn.duration(260).delay(i * 30)}>
              <PressScale scale={0.95} accessibilityRole="button" accessibilityLabel={`Abrir foto ${i + 1} de ${shown.length}`} onPress={() => setOpen(p.id)}>
                <Image source={{ uri: p.dataUrl }} style={styles.thumb} alt="" />
              </PressScale>
            </Animated.View>
          ))}
        </ScrollView>
      )}
      {!shown.length && <Text style={styles.empty}>{stage === "arrival" ? "Fotografe riscos e amassados na chegada: protege a oficina." : stage === "during" ? "Mostre a peça gasta ou o defeito encontrado." : "Mostre como o carro ficou."}</Text>}

      {canAdd && (
        <View style={styles.actions}>
          <PillButton full label={busy ? "Abrindo a câmera…" : `Tirar foto · ${PHOTO_STAGE_LABEL[stage]}`} icon={<Camera size={22} color={colors.primaryFg} weight="bold" />} onPress={() => take("camera")} disabled={busy} haptic />
          <Pressable accessibilityRole="button" onPress={() => take("library")} disabled={busy} style={styles.library} hitSlop={6}>
            <ImageSquare size={20} color={colors.primary} weight="bold" />
            <Text style={styles.libraryText}>Escolher da galeria</Text>
          </Pressable>
        </View>
      )}

      <Modal visible={!!current} animationType="fade" transparent onRequestClose={() => setOpen(null)}>
        {current && (
          <View style={[styles.viewer, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.md }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar foto" onPress={() => setOpen(null)} style={styles.close} hitSlop={8}><X size={24} color="#fff" weight="bold" /></Pressable>
            <Animated.View entering={FadeIn.duration(200)} style={styles.bigWrap}>
              <Image source={{ uri: current.dataUrl }} style={styles.big} resizeMode="contain" alt={`Foto do carro (${PHOTO_STAGE_LABEL[current.stage]})`} />
            </Animated.View>
            <Text style={styles.meta}>{formatDateTime(current.takenAt)} · {userOf(current.userId)?.name.split(" ")[0] ?? "Alguém"}</Text>
            <View style={styles.move} role="radiogroup" accessibilityLabel="Mudar o momento da foto">
              {PHOTO_STAGES.map((s) => {
                const on = current.stage === s.value;
                return (
                  <Pressable key={s.value} role="radio" aria-checked={on} onPress={() => { if (!on) { const r = act((db, ctx) => moveOrderPhoto(db, ctx, current.id, s.value)); if (r.ok) { showToast(`Foto movida para ${s.label}.`); setOpen(null); } else showToast(r.message); } }} style={[styles.moveBtn, on && styles.moveOn]}>
                    <Text style={[styles.moveText, on && { color: colors.text }]}>{s.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <PressScale accessibilityRole="button" onPress={() => remove(current.id)} style={styles.del}>
              <Trash size={18} color="#fff" weight="bold" /><Text style={styles.delText}>Apagar</Text>
            </PressScale>
          </View>
        )}
      </Modal>
    </View>
  );
}

const T = 104;
const styles = StyleSheet.create({
  box: { gap: space.sm, padding: space.md, borderRadius: radius.card, backgroundColor: colors.surface },
  stages: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 999, backgroundColor: "rgba(23,32,51,0.06)", alignSelf: "flex-start" },
  stage: { minHeight: 40, paddingHorizontal: 16, borderRadius: 999, justifyContent: "center" },
  stageOn: { backgroundColor: colors.surface, shadowColor: "#172033", shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  stageText: { fontSize: 15, fontWeight: "700", color: colors.muted },
  stageTextOn: { color: colors.text },
  thumbs: { gap: space.xs, paddingVertical: 2 },
  thumb: { width: T, height: T, borderRadius: 16, backgroundColor: colors.background },
  empty: { fontSize: 15, color: colors.muted },
  actions: { gap: space.xs, marginTop: space.xxs },
  library: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44 },
  libraryText: { fontSize: 15, fontWeight: "700", color: colors.primary },
  viewer: { flex: 1, backgroundColor: "rgba(8,12,24,0.96)", alignItems: "center", gap: space.sm, paddingHorizontal: space.md },
  close: { alignSelf: "flex-end", width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)" },
  bigWrap: { flex: 1, width: "100%" },
  big: { flex: 1, width: "100%", borderRadius: 14 },
  meta: { fontSize: 14, color: "rgba(255,255,255,0.85)" },
  move: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)" },
  moveBtn: { minHeight: 40, paddingHorizontal: 16, borderRadius: 999, justifyContent: "center" },
  moveOn: { backgroundColor: "#fff" },
  moveText: { fontSize: 15, fontWeight: "700", color: "rgba(255,255,255,0.85)" },
  del: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingHorizontal: 22, borderRadius: 999, backgroundColor: colors.danger },
  delText: { fontSize: 16, fontWeight: "800", color: "#fff" },
});
