import "server-only";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Senhas e PINs guardados só como resumo scrypt com sal ("scrypt$sal$resumo").
 * Fichas de aparelho e de sessão: 32 bytes aleatórios; no banco fica só o SHA-256.
 */
const PREFIX = "scrypt$";

const scryptAsync = promisify(scrypt) as (value: string, salt: string, keylen: number) => Promise<Buffer>;

/**
 * Resumo falso usado quando não há resumo guardado (e-mail que não existe):
 * a resposta demora o mesmo que uma senha errada, para não revelar quem tem conta.
 */
const DUMMY = { salt: "c2VtLWNvbnRhLWdhdnlv", length: 32 };

/** Resume sem travar o servidor (o scrypt roda fora da linha principal). */
export async function hashSecret(value: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const hash = (await scryptAsync(value, salt, 32)).toString("base64url");
  return `${PREFIX}${salt}$${hash}`;
}

export function isHashed(value: string | undefined | null): boolean {
  return !!value && value.startsWith(PREFIX);
}

export async function checkSecret(value: string, stored: string | null | undefined): Promise<boolean> {
  const [, salt, hash] = isHashed(stored) ? stored!.split("$") : [];
  const expected = hash ? Buffer.from(hash, "base64url") : null;
  if (!salt || !expected?.length) {
    await scryptAsync(String(value), DUMMY.salt, DUMMY.length);
    return false;
  }
  const got = await scryptAsync(String(value), salt, expected.length);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
