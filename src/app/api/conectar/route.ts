import { type NextRequest, NextResponse } from "next/server";
import { connectDevice } from "@/server/auth";
import { body, handle, setDeviceCookie } from "@/server/http";

/** O dono conecta este aparelho à oficina (e-mail e senha). */
export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const { email, password } = await body<{ email: string; password: string }>(req);
    const r = await connectDevice(email, password);
    const res = NextResponse.json({ workshopId: r.workshopId, workshopName: r.workshopName });
    setDeviceCookie(res, r.token);
    return res;
  });
}
