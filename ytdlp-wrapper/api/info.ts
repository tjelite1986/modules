import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchYtdlpMeta, YtdlpCookieError } from "@/lib/ytdlp";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { url } = body;
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const meta = await fetchYtdlpMeta(url);
    return NextResponse.json(meta);
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
      return NextResponse.json({ error: "Timeout while fetching metadata" }, { status: 504 });
    }
    return NextResponse.json({ error: msg || "Could not fetch metadata" }, { status: 422 });
  }
}
