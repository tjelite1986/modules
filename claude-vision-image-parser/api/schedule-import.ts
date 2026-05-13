import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  parseImageWithClaude,
  buildSchedulePrompt,
  ClaudeVisionError,
  type SupportedMediaType,
} from "@/lib/parse-image";

export const dynamic = "force-dynamic";

interface ScheduleResponse {
  shifts: { date: string; startTime: string; endTime: string }[];
}

/**
 * POST /api/schedule-import
 * FormData: { image: File, year?: string, month?: string }
 *
 * Returns: { shifts: [{ date, startTime, endTime }] }
 *
 * Reference implementation that uses parseImageWithClaude with the bundled
 * schedule prompt. Adapt for invoices, receipts, timesheets, etc. by
 * swapping the prompt and response type.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("image") as File | null;
    if (!file) return NextResponse.json({ error: "No image provided" }, { status: 400 });

    const validTypes: SupportedMediaType[] = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!validTypes.includes(file.type as SupportedMediaType)) {
      return NextResponse.json(
        { error: "Unsupported file format. Use PNG, JPEG, GIF or WEBP." },
        { status: 400 },
      );
    }

    const year = parseInt(formData.get("year") as string) || new Date().getFullYear();
    const month =
      parseInt(formData.get("month") as string) || new Date().getMonth() + 1;

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await parseImageWithClaude<ScheduleResponse>(
      buffer,
      file.type as SupportedMediaType,
      buildSchedulePrompt(year, month),
    );

    const shifts = (result.shifts ?? []).filter(
      (s) => s.date && s.startTime && s.endTime,
    );

    return NextResponse.json({ shifts });
  } catch (err) {
    if (err instanceof ClaudeVisionError) {
      return NextResponse.json(
        { error: err.message, raw: err.raw },
        { status: err.statusCode },
      );
    }
    return NextResponse.json({ error: "Server error during image parsing" }, { status: 500 });
  }
}
