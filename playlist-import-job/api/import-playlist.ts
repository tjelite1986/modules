import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { importPlaylist } from "@/lib/import-playlist";
import { YtdlpCookieError } from "@/lib/ytdlp";

/**
 * POST /api/admin/import-playlist
 * Body: { url: string, category?: string, is_adult?: boolean }
 *
 * Pulls every entry from a yt-dlp-supported playlist URL and writes it into
 * the `media` table in one transaction.
 *
 * Synchronous — for very large playlists, wrap with the background-job-template
 * to keep the request fast and report progress over a polling endpoint.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { url, category, is_adult } = body as {
    url?: string;
    category?: string;
    is_adult?: boolean;
  };

  if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 });

  try {
    const result = await importPlaylist(getDb(), url, { category, isAdult: is_adult });
    return NextResponse.json(result);
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
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `yt-dlp error: ${msg}` }, { status: 500 });
  }
}
