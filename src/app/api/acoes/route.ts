import { type NextRequest, NextResponse } from "next/server";
import type { CommandBatch } from "@/services/commands";
import { body, handle, requireSession } from "@/server/http";
import { applyBatch } from "@/server/workshop-store";

/** Recebe as ações com nome feitas na tela e repete no banco de verdade. */
export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const s = await requireSession(req);
    const batch = await body<CommandBatch>(req);
    return NextResponse.json(await applyBatch(s.workshopId, s.userId, batch));
  });
}
