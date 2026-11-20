import { type NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, isAdmin, listWorkshops } from "@/server/admin";
import { DomainError } from "@/services/core";
import { body, handle } from "@/server/http";
import { createDemoWorkshop, createWorkshop, type NewWorkshopInput } from "@/server/provision";

/**
 * Uso interno da GAVYO (decisões 74 e 98): lista e cria oficinas.
 * Aceita o cookie da tela da GAVYO ou `Authorization: Bearer <GAVYO_ADMIN_KEY>`.
 */
function guard(req: NextRequest) {
  if (!isAdmin(req.cookies.get(ADMIN_COOKIE)?.value, req.headers.get("authorization"))) {
    throw new DomainError("forbidden", "Entre com a chave da GAVYO.");
  }
}

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    guard(req);
    return NextResponse.json({ workshops: await listWorkshops() });
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    guard(req);
    const input = await body<NewWorkshopInput & { demo?: boolean }>(req);
    if (input.demo) {
      if (typeof input.ownerEmail !== "string" || typeof input.ownerPassword !== "string") throw new DomainError("validation", "Informe e-mail e senha.");
      return NextResponse.json(await createDemoWorkshop(input.ownerEmail, input.ownerPassword, input.ownerPin ?? "1234"));
    }
    return NextResponse.json(await createWorkshop(input));
  });
}
