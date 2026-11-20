import "server-only";
import { type NextRequest, NextResponse } from "next/server";
import { DomainError } from "@/services/core";
import { SESSION_HOURS, sessionOf } from "./auth";

export const DEVICE_COOKIE = "gv_dev";
export const SESSION_COOKIE = "gv_ses";

const STATUS: Record<DomainError["code"], number> = {
  validation: 400, forbidden: 403, not_found: 404, conflict: 409, offline: 503, unavailable: 503,
};

const secure = process.env.NODE_ENV === "production";

export function setDeviceCookie(res: NextResponse, token: string) {
  res.cookies.set(DEVICE_COOKIE, token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 400 * 86_400 });
}
export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: SESSION_HOURS * 3_600 });
}
export function clearCookie(res: NextResponse, name: string) {
  res.cookies.set(name, "", { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 0 });
}

/**
 * Toda rota passa por aqui: erros de regra viram a frase da regra; qualquer
 * outro erro vira uma frase genérica (o detalhe fica só no log do servidor).
 * POST exige o cabeçalho `x-gavyo` (um formulário de outro site não consegue mandar).
 */
export async function handle(req: NextRequest, fn: () => Promise<NextResponse>): Promise<NextResponse> {
  if (req.method !== "GET" && req.headers.get("x-gavyo") !== "1") {
    return NextResponse.json({ error: "Pedido recusado." }, { status: 403 });
  }
  try {
    const res = await fn();
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    if (e instanceof DomainError) return NextResponse.json({ error: e.message, code: e.code }, { status: STATUS[e.code] });
    console.error(e);
    return NextResponse.json({ error: "O servidor teve um problema. Tente de novo em instantes." }, { status: 500 });
  }
}

export async function requireSession(req: NextRequest) {
  const s = await sessionOf(req.cookies.get(DEVICE_COOKIE)?.value, req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) throw new DomainError("forbidden", "Sessão encerrada. Entre novamente.");
  return s;
}

export async function body<T>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new DomainError("validation", "Pedido inválido.");
  }
}
