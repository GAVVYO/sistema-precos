import { type NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, adminLogin } from "@/server/admin";
import { body, handle } from "@/server/http";

/** Tela da GAVYO: entra com a chave do servidor. */
export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const { key } = await body<{ key: string }>(req);
    const r = await adminLogin(key);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE, r.cookie, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: r.maxAge });
    return res;
  });
}
