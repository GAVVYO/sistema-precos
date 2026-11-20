import { type NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/server/auth";
import { DEVICE_COOKIE, handle, SESSION_COOKIE } from "@/server/http";
import { readState } from "@/server/workshop-store";

/** Dados da oficina de quem está usando. `?v=` igual à versão atual: 204 (nada mudou). */
export async function GET(req: NextRequest) {
  return handle(req, async () => {
    // Sem sessão não é erro: a tela só vai para a entrada.
    const s = await sessionOf(req.cookies.get(DEVICE_COOKIE)?.value, req.cookies.get(SESSION_COOKIE)?.value);
    if (!s) return NextResponse.json({ session: null });
    const v = req.nextUrl.searchParams.get("v");
    const state = await readState(s.workshopId, s.userId, v === null ? undefined : Number(v));
    if (!state) return new NextResponse(null, { status: 204 });
    return NextResponse.json({ session: s, ...state });
  });
}
