"use client";

import { ArrowLeft, ArrowRight, Camera, Trash, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/app-state/app-context";
import { toast } from "@/components/ui/toast";
import type { ServiceOrder, PhotoStage } from "@/domain/types";
import { formatDateTime } from "@/lib/format";
import { PHOTO_STAGE_LABEL, PHOTO_STAGES, photosOf, stageForStatus } from "@/services/photos";

/**
 * Fotos do carro na ficha do serviço (decisão 87): Chegou · Durante · Pronto.
 * A etapa já vem escolhida pela situação do serviço. "Tirar foto" abre a câmera
 * no celular e os arquivos no computador; a foto é reduzida antes de guardar.
 */

/** Reduz para o lado maior de 1024 px em JPEG (~100–150 KB). */
export async function shrinkPhoto(file: File, max = 1024): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.7);
}

export function OrderPhotos({ order }: { order: ServiceOrder }) {
  const { view, act, online, userOf } = useApp();
  const all = photosOf(view, order.id);
  const [stage, setStage] = useState<PhotoStage>(stageForStatus(order.status));
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const input = useRef<HTMLInputElement>(null);
  const shown = all.filter((p) => p.stage === stage);
  const canAdd = online && !order.cancelledAt;

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const added: string[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      try {
        const dataUrl = await shrinkPhoto(f);
        const r = act((c) => c.addOrderPhoto(order.id, { stage, dataUrl }));
        if (!r.ok) break;
        added.push(r.value.id);
      } catch {
        toast("error", "Não deu para ler essa foto. Tente outra.");
      }
    }
    if (added.length) {
      setFresh(new Set(added));
      toast("success", added.length === 1 ? `Foto salva em ${PHOTO_STAGE_LABEL[stage]}.` : `${added.length} fotos salvas em ${PHOTO_STAGE_LABEL[stage]}.`);
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  };

  const idx = shown.findIndex((p) => p.id === open);
  const current = idx >= 0 ? shown[idx] : null;

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); setOpen(null); }
      if (e.key === "ArrowRight" && idx < shown.length - 1) setOpen(shown[idx + 1].id);
      if (e.key === "ArrowLeft" && idx > 0) setOpen(shown[idx - 1].id);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [current, idx, shown]);

  return (
    <section className="osd-block ph" aria-labelledby="osd-photos">
      <div className="osd-h-row">
        <h3 id="osd-photos" className="osd-h">Fotos do carro <span className="osd-count">{all.length}</span></h3>
      </div>
      <div role="tablist" aria-label="Momento das fotos" className="ph-stages">
        {PHOTO_STAGES.map((s) => {
          const n = all.filter((p) => p.stage === s.value).length;
          return (
            <button key={s.value} type="button" role="tab" aria-selected={stage === s.value} onClick={() => setStage(s.value)}>
              {s.label}{n > 0 && <span className="ph-n">{n}</span>}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-label={`Fotos: ${PHOTO_STAGE_LABEL[stage]}`}>
      <ul key={stage} className="ph-grid">
        {shown.map((p, i) => (
          <li key={p.id} style={{ "--i": i } as React.CSSProperties} data-fresh={fresh.has(p.id) || undefined}>
            <button type="button" className="ph-thumb" onClick={() => setOpen(p.id)} aria-label={`Abrir foto ${i + 1} de ${shown.length} (${PHOTO_STAGE_LABEL[stage]})`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.dataUrl} alt="" loading="lazy" />
            </button>
          </li>
        ))}
        {canAdd && (
          <li>
            <label className="ph-add" data-busy={busy || undefined}>
              <Camera size={28} weight="duotone" aria-hidden />
              <span>{busy ? "Salvando…" : shown.length ? "Mais uma" : "Tirar foto"}</span>
              <input ref={input} type="file" accept="image/*" capture="environment" multiple className="sr-only" disabled={busy} onChange={(e) => add(e.target.files)} aria-label={`Tirar ou escolher foto (${PHOTO_STAGE_LABEL[stage]})`} />
            </label>
          </li>
        )}
      </ul>
      </div>
      {!shown.length && <p className="osd-empty">{stage === "arrival" ? "Fotografe riscos e amassados na chegada: protege a oficina." : stage === "during" ? "Mostre a peça gasta ou o defeito encontrado." : "Mostre como o carro ficou."}</p>}

      {current && (
        <div className="ph-view" role="dialog" aria-modal="true" aria-label={`Foto ${idx + 1} de ${shown.length}`} onClick={(e) => { if (e.target === e.currentTarget) setOpen(null); }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={current.id} src={current.dataUrl} alt={`Foto do carro (${PHOTO_STAGE_LABEL[current.stage]})`} className="ph-big" />
          <button type="button" className="ph-close" aria-label="Fechar foto" onClick={() => setOpen(null)}><X size={24} weight="bold" aria-hidden /></button>
          {idx > 0 && <button type="button" className="ph-nav is-prev" aria-label="Foto anterior" onClick={() => setOpen(shown[idx - 1].id)}><ArrowLeft size={24} weight="bold" aria-hidden /></button>}
          {idx < shown.length - 1 && <button type="button" className="ph-nav is-next" aria-label="Próxima foto" onClick={() => setOpen(shown[idx + 1].id)}><ArrowRight size={24} weight="bold" aria-hidden /></button>}
          <div className="ph-bar">
            <span className="ph-meta">{formatDateTime(current.takenAt)} · {userOf(current.userId)?.name.split(" ")[0] ?? "Alguém"}</span>
            <span className="ph-move" role="group" aria-label="Mudar o momento da foto">
              {PHOTO_STAGES.map((s) => (
                <button key={s.value} type="button" aria-pressed={current.stage === s.value} disabled={!online} onClick={() => { if (s.value !== current.stage) { act((c) => c.moveOrderPhoto(current.id, s.value), `Foto movida para ${s.label}.`); setOpen(null); } }}>{s.label}</button>
              ))}
            </span>
            <button type="button" className="ph-del" disabled={!online} onClick={() => { const r = act((c) => c.deleteOrderPhoto(current.id), "Foto apagada."); if (r.ok) setOpen(null); }}><Trash size={18} weight="bold" aria-hidden /> Apagar</button>
          </div>
        </div>
      )}
    </section>
  );
}
