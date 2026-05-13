import { NextRequest } from "next/server";
import fs from "node:fs";
import { Readable } from "node:stream";
import archiver from "archiver";
import { verifyTokenLoose } from "@/lib/auth";
import { getItem, getFilePath } from "@/lib/gallery";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseIds(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export async function GET(req: NextRequest) {
  const user = verifyTokenLoose(req);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const ids = parseIds(req.nextUrl.searchParams.get("ids"));
  if (ids.length === 0) return new Response("No items", { status: 400 });

  const items = ids
    .map((id) => getItem(user.id, id))
    .filter((it): it is NonNullable<typeof it> => it !== null);
  if (items.length === 0) return new Response("Not found", { status: 404 });

  const archive = archiver("zip", { store: true });
  archive.on("warning", () => {});
  archive.on("error", () => {});

  const seen = new Map<string, number>();
  for (const item of items) {
    const filePath = getFilePath(item, "original");
    if (!fs.existsSync(filePath)) continue;
    let name = item.filename;
    const count = seen.get(name) ?? 0;
    if (count > 0) {
      const dot = name.lastIndexOf(".");
      const base = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : "";
      name = `${base} (${count})${ext}`;
    }
    seen.set(item.filename, count + 1);
    archive.file(filePath, { name });
  }

  archive.finalize();

  const stream = Readable.toWeb(archive as unknown as Readable);
  const filename = `gallery-${new Date().toISOString().slice(0, 10)}.zip`;
  return new Response(stream as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
