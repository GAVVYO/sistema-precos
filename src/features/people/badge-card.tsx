"use client";

import { Camera, Check } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { useApp } from "@/app-state/app-context";
import { initialsOf } from "@/components/ui/person-avatar";
import { MiniPlate } from "@/features/dashboard/yard";
import { formatDate, formatPhone, todayISO } from "@/lib/format";

/**
 * Crachá que se preenche enquanto a pessoa digita (mesma ideia do desenho do
 * Receber) e recebe o carimbo "Cadastro concluído" ao salvar. Só ilustração:
 * os dados de verdade estão no formulário ao lado (aria-hidden aqui).
 */
export function BadgeCard({ kind, name, phone, roleLabel, photo, plate, since, stamped }: {
  kind: "staff" | "customer";
  name: string;
  phone: string;
  roleLabel?: string;
  photo?: string | null;
  plate?: string;
  since?: string;
  stamped?: boolean;
}) {
  const { settings } = useApp();
  const digits = phone.replace(/\D/g, "");
  return (
    <div className="badge-scene" aria-hidden>
      <span className="badge-strap" />
      <div className="badge-card" data-stamped={stamped || undefined} data-kind={kind}>
        <span className="badge-slot" />
        <div className="badge-band">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {settings.logoDataUrl ? <img src={settings.logoDataUrl} alt="" className="badge-logo" /> : <span className="badge-logo is-mark">{initialsOf(settings.displayName)}</span>}
          <span className="badge-shop">{settings.displayName}</span>
        </div>
        <div className="badge-photo" data-empty={!photo || undefined}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photo ? <img key={photo.slice(-24)} src={photo} alt="" /> : name.trim() ? <span className="badge-initials">{initialsOf(name)}</span> : <Camera size={34} weight="duotone" />}
        </div>
        <p className="badge-name" data-empty={!name.trim() || undefined}>{name.trim() || "Nome aparece aqui"}</p>
        <p className="badge-role">{kind === "customer" ? "Cliente" : roleLabel || "Função"}</p>
        <p className="badge-line" data-empty={digits.length < 10 || undefined}>{digits.length >= 10 ? formatPhone(digits) : "(00) 00000-0000"}</p>
        {kind === "customer" && <div className="badge-plate">{plate ? <MiniPlate plate={plate} /> : <span className="badge-noplate">Sem carro ainda</span>}</div>}
        <p className="badge-foot">{kind === "customer" ? "Cliente" : "Equipe"} desde {formatDate(since ?? todayISO())}</p>
        {stamped && (
          <span className="badge-stamp">
            <Stamper />
            <span className="badge-stamp-inner">
              <Check size={22} weight="bold" />
              <span>Cadastro<br />concluído</span>
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

/** O carimbador (cabo + base de borracha), visto de lado, que desce e aperta. */
function Stamper() {
  return (
    <svg className="badge-stamper" viewBox="0 0 200 200" width="200" height="200">
      <defs>
        <linearGradient id="stp-knob" x1="0" x2="1"><stop offset="0" stopColor="#1f2430" /><stop offset=".45" stopColor="#4b5262" /><stop offset="1" stopColor="#1a1e27" /></linearGradient>
        <linearGradient id="stp-wood" x1="0" x2="1"><stop offset="0" stopColor="#7a4a22" /><stop offset=".4" stopColor="#b07a45" /><stop offset="1" stopColor="#6b3f1c" /></linearGradient>
        <linearGradient id="stp-metal" x1="0" x2="1"><stop offset="0" stopColor="#9aa3b2" /><stop offset=".5" stopColor="#e6eaf0" /><stop offset="1" stopColor="#8a93a3" /></linearGradient>
      </defs>
      {/* pegador */}
      <ellipse cx="100" cy="32" rx="36" ry="28" fill="url(#stp-knob)" />
      <ellipse cx="89" cy="21" rx="13" ry="6" fill="#fff" opacity=".22" />
      {/* pescoço */}
      <path d="M87 56h26l7 46H80z" fill="url(#stp-knob)" />
      {/* corpo de madeira, da largura da marca */}
      <path d="M24 102h152a10 10 0 0 1 10 10v50H14v-50a10 10 0 0 1 10-10z" fill="url(#stp-wood)" />
      <path d="M26 109h148" stroke="#fff" strokeOpacity=".18" strokeWidth="3" strokeLinecap="round" />
      {/* chapa e borracha com tinta (embaixo de tudo, encosta na marca) */}
      <rect x="8" y="162" width="184" height="14" rx="3" fill="url(#stp-metal)" />
      <rect x="12" y="176" width="176" height="20" rx="3" fill="#14532d" />
      <rect x="12" y="192" width="176" height="6" rx="2" fill="#16a34a" />
    </svg>
  );
}

/** Reduz a foto para um quadrado de 256 px (JPEG) antes de guardar. */
async function toThumb(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const g = canvas.getContext("2d")!;
  g.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

/** "Tirar ou escolher foto": no celular abre a câmera; no computador, os arquivos. */
export function PhotoPicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  return (
    <div className="photo-picker">
      <span className="choice-legend">Foto <span className="font-normal text-muted">(opcional)</span></span>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="photo-btn" onClick={() => input.current?.click()}>
          <Camera size={20} weight="duotone" aria-hidden />
          {value ? "Trocar foto" : "Tirar ou escolher foto"}
        </button>
        {value && <button type="button" className="photo-btn is-quiet" onClick={() => onChange(null)}>Tirar a foto</button>}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="user"
        className="sr-only"
        tabIndex={-1}
        aria-label="Escolher foto"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setError("");
          try { onChange(await toThumb(file)); } catch { setError("Não deu para abrir essa imagem. Tente outra foto."); }
        }}
      />
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}
