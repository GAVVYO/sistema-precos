import { type NextRequest, NextResponse } from "next/server";
import { deviceOf, peopleOf } from "@/server/auth";
import { DEVICE_COOKIE, handle } from "@/server/http";

/** "Quem está entrando?" — aparelho sem conexão recebe `connected: false`. */
export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const device = await deviceOf(req.cookies.get(DEVICE_COOKIE)?.value);
    if (!device) return NextResponse.json({ connected: false });
    return NextResponse.json({ connected: true, workshopId: device.workshopId, ...(await peopleOf(device)) });
  });
}
