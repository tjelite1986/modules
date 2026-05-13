import { NextRequest } from "next/server";
import fs from "node:fs";
import { verifyTokenLoose } from "@/lib/auth";
import { getItemBySharedToken, getFilePath } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  const viewer = verifyTokenLoose(req);
  if (!viewer) return new Response("Unauthorized", { status: 401 });

  const found = getItemBySharedToken(params.token);
  if (!found) return new Response("Not found", { status: 404 });

  const variant = req.nextUrl.searchParams.get("variant") === "thumb" ? "thumb" : "preview";
  const file = getFilePath(found.item, variant);
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
