import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { DomainError } from "@/services/core";
import { body, handle } from "@/server/http";
import { createDemoWorkshop, createWorkshop, type NewWorkshopInput } from "@/server/provision";

/**
 * Uso interno da GAVYO: cria uma oficina e o primeiro dono (decisão 74).
 * Protegido pela chave GAVYO_ADMIN_KEY do servidor (pelo menos 24 caracteres),
 * enviada em `Authorization: Bearer …`. Sem a chave configurada, a rota não existe.
 */
function authorized(req: NextRequest): boolean {
  const key = process.env.GAVYO_ADMIN_KEY ?? "";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (key.length < 24 || got.length !== key.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(key));
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    if (!authorized(req)) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
    const input = await body<NewWorkshopInput & { demo?: boolean }>(req);
    if (input.demo) {
      if (typeof input.ownerEmail !== "string" || typeof input.ownerPassword !== "string") throw new DomainError("validation", "Informe e-mail e senha.");
      return NextResponse.json(await createDemoWorkshop(input.ownerEmail, input.ownerPassword, input.ownerPin ?? "1234"));
    }
    return NextResponse.json(await createWorkshop(input));
  });
}
