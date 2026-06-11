import { NextRequest, NextResponse } from "next/server";
import { verifyTokenLoose } from "@/lib/auth";
import { posterFilePath, posterMime, decodeSlugFromUrl } from "@/lib/clips";
import fs from "node:fs";

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
}

export async function GET(req: NextRequest, { params }: Props) {
  if (!verifyTokenLoose(req)) return new Response("Unauthorized", { status: 401 });
  const slug = decodeSlugFromUrl(decodeURIComponent(params.slug));
  const found = posterFilePath(slug);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buf = fs.readFileSync(found.file);
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": posterMime(found.ext),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
