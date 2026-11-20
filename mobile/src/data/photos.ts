import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Linking } from "react-native";
import type { ID, PhotoStage } from "@core/domain/types";
import { addOrderPhoto, PHOTO_STAGE_LABEL } from "@core/services/photos";
import { act } from "./store";
import { showToast } from "./toast";

/**
 * Tirar (ou escolher) foto do carro e guardar no serviço (decisão 87).
 * A foto é reduzida no celular (lado maior 1024 px, JPEG) antes de guardar.
 * Fase 2: envia o arquivo para o servidor em vez de guardar no aparelho.
 */
export async function capturePhoto(orderId: ID, stage: PhotoStage, from: "camera" | "library" = "camera"): Promise<boolean> {
  const perm = from === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    showToast(from === "camera" ? "Sem permissão da câmera. Libere nos ajustes do celular." : "Sem permissão das fotos. Libere nos ajustes do celular.");
    if (!perm.canAskAgain) Linking.openSettings();
    return false;
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.8, allowsEditing: false };
  const r = from === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync({ ...opts, allowsMultipleSelection: true, selectionLimit: 6 });
  if (r.canceled || !r.assets?.length) return false;
  let saved = 0;
  for (const a of r.assets) {
    const wide = (a.width ?? 0) >= (a.height ?? 0);
    const small = await manipulateAsync(a.uri, [{ resize: wide ? { width: Math.min(1024, a.width || 1024) } : { height: Math.min(1024, a.height || 1024) } }], { compress: 0.68, format: SaveFormat.JPEG, base64: true });
    if (!small.base64) continue;
    const res = act((db, ctx) => { addOrderPhoto(db, ctx, orderId, { stage, dataUrl: `data:image/jpeg;base64,${small.base64}` }); });
    if (!res.ok) { showToast(res.message); break; }
    saved += 1;
  }
  if (saved) showToast(saved === 1 ? `Foto salva em ${PHOTO_STAGE_LABEL[stage]}.` : `${saved} fotos salvas em ${PHOTO_STAGE_LABEL[stage]}.`);
  return saved > 0;
}
