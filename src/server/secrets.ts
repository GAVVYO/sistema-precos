import "server-only";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Senhas e PINs guardados só como resumo scrypt com sal ("scrypt$sal$resumo").
 * Fichas de aparelho e de sessão: 32 bytes aleatórios; no banco fica só o SHA-256.
 */
const PREFIX = "scrypt$";

export function hashSecret(value: string): string {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(value, salt, 32).toString("base64url");
  return `${PREFIX}${salt}$${hash}`;
}

export function isHashed(value: string | undefined | null): boolean {
  return !!value && value.startsWith(PREFIX);
}

export function checkSecret(value: string, stored: string | null | undefined): boolean {
  if (!stored || !isHashed(stored)) return false;
  const [, salt, hash] = stored.split("$");
  const expected = Buffer.from(hash, "base64url");
  const got = scryptSync(value, salt, expected.length);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
