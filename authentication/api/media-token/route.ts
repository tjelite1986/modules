import { NextRequest, NextResponse } from "next/server";
import { verifyToken, signMediaToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Issues a short-lived, media-scoped token for use in ?t= query strings
// on <img>/<video> resources. Requires a regular session token.
export async function GET(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ token: signMediaToken(user) });
}
