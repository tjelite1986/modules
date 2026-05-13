import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import { cookiesFilePath, hasCookies } from "@/lib/instagram";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = verifyAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    enabled: hasCookies(),
    path: cookiesFilePath(),
    hostPath: cookiesFilePath().replace(/^\/store\//, "/mnt/4tb/elite/"),
  });
}
