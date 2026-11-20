import { type NextRequest, NextResponse } from "next/server";
import { disconnectDevice } from "@/server/auth";
import { clearCookie, DEVICE_COOKIE, handle, SESSION_COOKIE } from "@/server/http";

/** Desconecta este aparelho da oficina (volta a pedir o e-mail do dono). */
export async function POST(req: NextRequest) {
  return handle(req, async () => {
    await disconnectDevice(req.cookies.get(DEVICE_COOKIE)?.value);
    const res = NextResponse.json({ ok: true });
    clearCookie(res, SESSION_COOKIE);
    clearCookie(res, DEVICE_COOKIE);
    return res;
  });
}
