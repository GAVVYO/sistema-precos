import { type NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/server/admin";
import { clearCookie, handle } from "@/server/http";

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const res = NextResponse.json({ ok: true });
    clearCookie(res, ADMIN_COOKIE);
    return res;
  });
}
