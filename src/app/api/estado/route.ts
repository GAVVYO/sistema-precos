import { type NextRequest, NextResponse } from "next/server";
import { handle, requireSession } from "@/server/http";
import { readState } from "@/server/workshop-store";

/** Dados da oficina de quem está usando. `?v=` igual à versão atual: 204 (nada mudou). */
export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const s = await requireSession(req);
    const v = req.nextUrl.searchParams.get("v");
    const state = await readState(s.workshopId, s.userId, v === null ? undefined : Number(v));
    if (!state) return new NextResponse(null, { status: 204 });
    return NextResponse.json({ session: s, ...state });
  });
}
