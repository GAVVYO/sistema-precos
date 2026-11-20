import { type NextRequest, NextResponse } from "next/server";
import { deviceOf, pinLogin } from "@/server/auth";
import { DomainError } from "@/services/core";
import { body, DEVICE_COOKIE, handle, setSessionCookie } from "@/server/http";

/** A pessoa toca no nome e digita o PIN. */
export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const device = await deviceOf(req.cookies.get(DEVICE_COOKIE)?.value);
    if (!device) throw new DomainError("forbidden", "Este aparelho não está conectado. Peça para o dono entrar com o e-mail.");
    const { userId, pin } = await body<{ userId: string; pin: string }>(req);
    const s = await pinLogin(device, userId, pin);
    const res = NextResponse.json({ workshopId: device.workshopId, userId });
    setSessionCookie(res, s.token);
    return res;
  });
}
