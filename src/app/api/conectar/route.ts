import { type NextRequest, NextResponse } from "next/server";
import { connectDevice, ownerSession } from "@/server/auth";
import { body, handle, setDeviceCookie, setSessionCookie } from "@/server/http";

/** O dono conecta este aparelho à oficina (e-mail e senha) e já entra. */
export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const { email, password } = await body<{ email: string; password: string }>(req);
    const r = await connectDevice(email, password);
    const s = await ownerSession(r.token, r.workshopId, r.userId);
    const res = NextResponse.json({ workshopId: r.workshopId, workshopName: r.workshopName, userId: r.userId });
    setDeviceCookie(res, r.token);
    setSessionCookie(res, s.token);
    return res;
  });
}
