import { type NextRequest, NextResponse } from "next/server";
import { endSession } from "@/server/auth";
import { clearCookie, handle, SESSION_COOKIE } from "@/server/http";

/** Sai (o aparelho continua conectado à oficina). */
export async function POST(req: NextRequest) {
  return handle(req, async () => {
    await endSession(req.cookies.get(SESSION_COOKIE)?.value);
    const res = NextResponse.json({ ok: true });
    clearCookie(res, SESSION_COOKIE);
    return res;
  });
}
