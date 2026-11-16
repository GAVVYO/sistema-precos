/**
 * Modo da aplicação.
 *
 * - "demo": dados fictícios persistidos no navegador (fase 1).
 * - "production": exige o backend real (MySQL + Prisma + sessão). Enquanto ele
 *   não existir, a aplicação informa a indisponibilidade — NUNCA cai
 *   silenciosamente para os dados de demonstração.
 *
 * Somente este valor é público. Credenciais (DATABASE_URL etc.) jamais usam
 * o prefixo NEXT_PUBLIC e ficam restritas ao servidor.
 */
export type AppMode = "demo" | "production";

export const APP_MODE: AppMode =
  process.env.NEXT_PUBLIC_APP_MODE === "production" ? "production" : "demo";

/** A fase 1 não possui backend de produção. */
export const PRODUCTION_BACKEND_READY = false;
