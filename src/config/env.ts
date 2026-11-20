/**
 * Modo da aplicação.
 *
 * - "demo": dados fictícios persistidos no navegador (fase 1).
 * - "production": dados no servidor (MySQL + sessão, decisões 96–97). Se o
 *   servidor não responde, a tela diz que está sem conexão — NUNCA cai
 *   silenciosamente para os dados de demonstração.
 *
 * Somente este valor é público. Credenciais (DATABASE_URL etc.) jamais usam
 * o prefixo NEXT_PUBLIC e ficam restritas ao servidor.
 */
export type AppMode = "demo" | "production";

export const APP_MODE: AppMode =
  process.env.NEXT_PUBLIC_APP_MODE === "production" ? "production" : "demo";

/** Fase 2: o servidor existe (decisões 96–97). */
export const PRODUCTION_BACKEND_READY = true;
