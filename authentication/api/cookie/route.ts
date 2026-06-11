import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { setAuthCookie } from "@/lib/authCookie";

export const dynamic = "force-dynamic";

// Self-heal for sessions created before the auth cookie existed: the login
// page calls this with the stored bearer token so middleware lets the
// browser back in without re-entering credentials.
export async function POST(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = req.headers.get("Authorization")!.slice(7);
  const res = NextResponse.json({ ok: true });
  setAuthCookie(res, token, req);
  return res;
}
