import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { searchYoutube, YtdlpCookieError } from "@/lib/ytdlp";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q is required" }, { status: 400 });

  try {
    const results = await searchYoutube(q);
    return NextResponse.json({ results });
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
    return NextResponse.json({ error: msg || "Search failed" }, { status: 422 });
  }
}
