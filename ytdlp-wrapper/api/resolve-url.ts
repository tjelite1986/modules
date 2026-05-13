import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveYtdlpUrl, YtdlpCookieError } from "@/lib/ytdlp";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const streamUrl = await resolveYtdlpUrl(url);
    return NextResponse.json({ url: streamUrl });
  } catch (err: unknown) {
    if (err instanceof YtdlpCookieError) {
      return NextResponse.json(
        {
          error:
            "YouTube cookies have expired or are missing. Please update cookies.txt.",
          error_code: "COOKIES_EXPIRED",
        },
        { status: 403 },
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ETIMEDOUT") || msg.includes("timed out") || msg.includes("timeout")) {
      return NextResponse.json({ error: "Timeout while fetching stream URL" }, { status: 504 });
    }
    return NextResponse.json({ error: msg || "Could not fetch stream URL" }, { status: 422 });
  }
}
