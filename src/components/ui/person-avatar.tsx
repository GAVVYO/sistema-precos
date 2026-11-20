import { cx } from "./primitives";

/** Tons calmos para as iniciais; a cor sai do nome, então a pessoa tem sempre a mesma. */
const TONES = ["#2563eb", "#0f766e", "#b45309", "#7c3aed", "#be123c", "#0369a1", "#4d7c0f", "#a16207"];

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function toneOf(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

/** Foto da pessoa ou, sem foto, as iniciais num círculo colorido. Decorativo: o nome está ao lado. */
export function PersonAvatar({ name, photo, size = 44, className }: { name: string; photo?: string | null; size?: number; className?: string }) {
  return (
    <span className={cx("person-avatar", className)} style={{ width: size, height: size, ["--tone" as string]: toneOf(name || "?"), fontSize: size * 0.38 }} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {photo ? <img src={photo} alt="" width={size} height={size} /> : initialsOf(name)}
    </span>
  );
}
