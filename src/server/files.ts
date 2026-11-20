import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import type { Database, ID } from "@/domain/types";
import { DomainError, FILE_URL } from "@/services/core";

/**
 * Fotos e logos como arquivo (decisão 99). A tela manda a foto já reduzida
 * (data URL); ao gravar, o servidor salva o arquivo e guarda no banco só o
 * endereço `/api/arquivos/<oficina>/<nome>`. Só quem é da oficina abre.
 *
 * Pasta: UPLOAD_DIR, ou `~/gavyo-arquivos` — fora da pasta do app, para uma
 * publicação nova não apagar as fotos.
 */
export function uploadRoot(): string {
  return process.env.UPLOAD_DIR || path.join(homedir(), "gavyo-arquivos");
}

const MAX_BYTES = 2_000_000;
const TYPES: Record<string, { ext: string; magic: (b: Buffer) => boolean }> = {
  "image/jpeg": { ext: "jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { ext: "png", magic: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/webp": { ext: "webp", magic: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
};
export const CONTENT_TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Onde fica cada campo de imagem. */
const FIELDS: { kind: "orderPhotos" | "parts" | "settings" | "users"; field: string }[] = [
  { kind: "orderPhotos", field: "dataUrl" },
  { kind: "parts", field: "photo" },
  { kind: "settings", field: "logoDataUrl" },
  { kind: "users", field: "photo" },
];

async function save(workshopId: ID, dataUrl: string): Promise<string> {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  const type = m ? TYPES[m[1]] : undefined;
  if (!m || !type) throw new DomainError("validation", "Arquivo de imagem inválido.");
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length > MAX_BYTES) throw new DomainError("validation", "Foto grande demais. Tente de novo.");
  if (!type.magic(bytes)) throw new DomainError("validation", "Arquivo de imagem inválido.");
  const name = `${crypto.randomUUID()}.${type.ext}`;
  const dir = path.join(uploadRoot(), workshopId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes, { mode: 0o640 });
  return `/api/arquivos/${workshopId}/${name}`;
}

/** Troca, no banco, toda foto em data URL pelo arquivo salvo. Devolve os arquivos criados. */
export async function externalizeImages(db: Database, workshopId: ID): Promise<string[]> {
  const created: string[] = [];
  for (const { kind, field } of FIELDS) {
    for (const item of db[kind] as unknown as Record<string, unknown>[]) {
      const v = item[field];
      if (typeof v === "string" && v.startsWith("data:")) {
        const url = await save(workshopId, v);
        created.push(url);
        item[field] = url;
      }
    }
  }
  return created;
}

function filesOf(db: Database, workshopId: ID): Set<string> {
  const out = new Set<string>();
  const prefix = `/api/arquivos/${workshopId}/`;
  for (const { kind, field } of FIELDS) {
    for (const item of db[kind] as unknown as Record<string, unknown>[]) {
      const v = item[field];
      if (typeof v === "string" && v.startsWith(prefix)) out.add(v);
    }
  }
  return out;
}

/** Arquivos que existiam antes e não são mais usados (foto apagada ou trocada). */
export function unusedFiles(before: Database, after: Database, workshopId: ID): string[] {
  const still = filesOf(after, workshopId);
  return [...filesOf(before, workshopId)].filter((u) => !still.has(u));
}

/** Caminho no disco de um endereço `/api/arquivos/...` (nunca sai da pasta da oficina). */
export function diskPath(url: string): { workshopId: ID; file: string; ext: string } | null {
  if (!FILE_URL.test(url)) return null;
  const [, , , workshopId, name] = url.split("/");
  return { workshopId, file: path.join(uploadRoot(), workshopId, name), ext: name.split(".").pop()! };
}

export async function removeFiles(urls: string[]): Promise<void> {
  for (const u of urls) {
    const p = diskPath(u);
    if (p) await unlink(p.file).catch(() => {});
  }
}

export async function readImage(workshopId: ID, name: string): Promise<{ bytes: Buffer; type: string } | null> {
  const p = diskPath(`/api/arquivos/${workshopId}/${name}`);
  if (!p || p.workshopId !== workshopId) return null;
  try {
    return { bytes: await readFile(p.file), type: CONTENT_TYPES[p.ext] };
  } catch {
    return null;
  }
}
