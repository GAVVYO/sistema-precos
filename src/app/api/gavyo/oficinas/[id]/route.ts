import { type NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, isAdmin, resetOwnerPassword, setWorkshopActive } from "@/server/admin";
import { DomainError } from "@/services/core";
import { body, handle } from "@/server/http";

/** Trocar a senha do dono ou ativar/desativar a oficina. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    if (!isAdmin(req.cookies.get(ADMIN_COOKIE)?.value, req.headers.get("authorization"))) throw new DomainError("forbidden", "Entre com a chave da GAVYO.");
    const { id } = await ctx.params;
    const input = await body<{ action: "password"; password: string } | { action: "active"; active: boolean }>(req);
    if (input.action === "password") await resetOwnerPassword(id, input.password);
    else if (input.action === "active" && typeof input.active === "boolean") await setWorkshopActive(id, input.active);
    else throw new DomainError("validation", "Pedido inválido.");
    return NextResponse.json({ ok: true });
  });
}
