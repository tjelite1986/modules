import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { ingestUpload } from "@/lib/gallery";

export const dynamic = "force-dynamic";

const MAX_BYTES = 500 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const files = form.getAll("file").filter((v): v is File => v instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const created: any[] = [];
  const errors: Array<{ filename: string; error: string }> = [];

  for (const file of files) {
    try {
      if (file.size > MAX_BYTES) {
        errors.push({ filename: file.name, error: "File too large" });
        continue;
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const lastModified =
        typeof file.lastModified === "number" && file.lastModified > 0
          ? new Date(file.lastModified)
          : undefined;
      const item = await ingestUpload({
        userId: user.id,
        filename: file.name || "upload",
        mimeType: file.type || "application/octet-stream",
        buffer,
        fallbackTakenAt: lastModified,
      });
      created.push(item);
    } catch (err: any) {
      errors.push({ filename: file.name, error: err?.message || "Upload failed" });
    }
  }

  return NextResponse.json({ items: created, errors });
}
