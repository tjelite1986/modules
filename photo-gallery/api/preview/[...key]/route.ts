import { NextRequest } from "next/server";
import { verifyTokenLoose } from "@/lib/auth";
import { getItemForViewing, getFilePath } from "@/lib/gallery";
import fs from "node:fs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { key: string[] } }) {
  const user = verifyTokenLoose(req);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const storageKey = params.key.map((p) => decodeURIComponent(p)).join("/");
  const item = getItemForViewing(user.id, storageKey);
  if (!item) return new Response("Not found", { status: 404 });

  const file = getFilePath(item, "preview");
  if (!fs.existsSync(file)) return new Response("Not found", { status: 404 });

  const buf = fs.readFileSync(file);
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(buf.length),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
