import { z } from "zod";
import type { Database, ID, OrderPhoto, OrderStatus, PhotoStage } from "@/domain/types";
import { assertCan, type Ctx, DomainError, findScoped, newId, parse } from "./core";

/**
 * Fotos do carro no serviço (decisão 87): como chegou (riscos e amassados, para
 * a oficina se proteger), durante o conserto e como ficou pronto. Todos da
 * oficina tiram e veem; apagar é de quem tirou ou de quem edita o serviço.
 * Demonstração: JPEG reduzido guardado no navegador/celular. Fase 2: arquivo no servidor.
 */

export const PHOTO_STAGES: { value: PhotoStage; label: string }[] = [
  { value: "arrival", label: "Chegou" },
  { value: "during", label: "Durante" },
  { value: "done", label: "Pronto" },
];
export const PHOTO_STAGE_LABEL: Record<PhotoStage, string> = { arrival: "Chegou", during: "Durante", done: "Pronto" };
/** Etapa sugerida pela situação do serviço (a pessoa pode trocar). */
export const stageForStatus = (s: OrderStatus): PhotoStage => (s === "waiting" ? "arrival" : s === "in_progress" ? "during" : "done");

export const MAX_PHOTOS_PER_ORDER = 30;
/** ~700 KB em base64: a foto chega já reduzida (lado maior 1280 px). */
const MAX_DATA_URL = 950_000;

const photoSchema = z.object({
  stage: z.enum(["arrival", "during", "done"]),
  dataUrl: z.string().regex(/^data:image\/(jpeg|png|webp);base64,/, "Arquivo de imagem inválido.").max(MAX_DATA_URL, "Foto grande demais. Tente de novo."),
});

export function addOrderPhoto(db: Database, ctx: Ctx, orderId: ID, input: z.input<typeof photoSchema>): OrderPhoto {
  assertCan(db, ctx, "os.view");
  const order = findScoped(db.orders, ctx, orderId, "Serviço não encontrado.");
  if (order.cancelledAt) throw new DomainError("conflict", "Serviço cancelado não recebe fotos.");
  const data = parse(photoSchema, input);
  db.orderPhotos ??= [];
  if (db.orderPhotos.filter((p) => p.orderId === orderId).length >= MAX_PHOTOS_PER_ORDER) {
    throw new DomainError("conflict", `Este serviço já tem ${MAX_PHOTOS_PER_ORDER} fotos. Apague alguma para tirar outra.`);
  }
  const photo: OrderPhoto = { id: newId(), workshopId: ctx.workshopId, orderId, stage: data.stage, dataUrl: data.dataUrl, takenAt: ctx.now.toISOString(), userId: ctx.userId };
  db.orderPhotos.push(photo);
  return photo;
}

export function moveOrderPhoto(db: Database, ctx: Ctx, photoId: ID, stage: PhotoStage): void {
  assertCan(db, ctx, "os.view");
  const photo = findScoped(db.orderPhotos ?? [], ctx, photoId, "Foto não encontrada.");
  if (photo.userId !== ctx.userId) assertCan(db, ctx, "os.edit");
  photo.stage = parse(photoSchema.shape.stage, stage);
}

export function deleteOrderPhoto(db: Database, ctx: Ctx, photoId: ID): void {
  assertCan(db, ctx, "os.view");
  const photo = findScoped(db.orderPhotos ?? [], ctx, photoId, "Foto não encontrada.");
  // Quem tirou pode apagar; a foto de outra pessoa só quem edita o serviço.
  if (photo.userId !== ctx.userId) assertCan(db, ctx, "os.edit");
  db.orderPhotos = db.orderPhotos.filter((p) => p.id !== photoId);
}

export function photosOf(db: { orderPhotos?: OrderPhoto[] }, orderId: ID): OrderPhoto[] {
  return (db.orderPhotos ?? []).filter((p) => p.orderId === orderId).sort((a, b) => a.takenAt.localeCompare(b.takenAt));
}
