import { type NextRequest, NextResponse } from "next/server";
import { readImage } from "@/server/files";
import { DEVICE_COOKIE, SESSION_COOKIE } from "@/server/http";
import { sessionOf } from "@/server/auth";

/** Foto ou logo da oficina: só para quem está dentro dela (decisão 99). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ ws: string; name: string }> }) {
  const { ws, name } = await ctx.params;
  const s = await sessionOf(req.cookies.get(DEVICE_COOKIE)?.value, req.cookies.get(SESSION_COOKIE)?.value).catch(() => null);
  if (!s || s.workshopId !== ws) return new NextResponse(null, { status: 404 });
  const img = await readImage(ws, name);
  if (!img) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(img.bytes), {
    headers: {
      "Content-Type": img.type,
      // O nome do arquivo nunca muda de conteúdo: pode guardar no aparelho.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
