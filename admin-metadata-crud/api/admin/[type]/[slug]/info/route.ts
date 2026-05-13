import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { isValidType, isValidSlug, assetsDir, infoFile } from "@/lib/store";
import fs from "node:fs";

export const dynamic = "force-dynamic";

function escapeYaml(s: string): string {
  if (s.includes("\n") || s.includes(":") || s.includes("#") || s.match(/^[\s'"\[\]{}|>*&!%@`]/)) {
    return JSON.stringify(s);
  }
  return s;
}

function buildMarkdown(data: {
  name: string;
  developer?: string;
  category?: string;
  tagline?: string;
  description?: string;
  website?: string;
  tags?: string[];
  body?: string;
}): string {
  const lines = ["---"];
  lines.push(`name: ${escapeYaml(data.name)}`);
  if (data.developer) lines.push(`developer: ${escapeYaml(data.developer)}`);
  if (data.category) lines.push(`category: ${escapeYaml(data.category)}`);
  if (data.tagline) lines.push(`tagline: ${escapeYaml(data.tagline)}`);
  if (data.description) lines.push(`description: ${escapeYaml(data.description)}`);
  if (data.website) lines.push(`website: ${escapeYaml(data.website)}`);
  if (data.tags && data.tags.length > 0) {
    lines.push(`tags: [${data.tags.map((t) => escapeYaml(t)).join(", ")}]`);
  }
  lines.push("---");
  lines.push("");
  if (data.body) lines.push(data.body.trim());
  lines.push("");
  return lines.join("\n");
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { type: string; slug: string } },
) {
  const guard = await requireAdmin();
  if (guard) return guard;
  if (!isValidType(params.type)) return new NextResponse("Bad type", { status: 400 });
  if (!isValidSlug(params.slug)) return new NextResponse("Bad slug", { status: 400 });

  const data = await req.json();
  if (typeof data.name !== "string" || !data.name.trim()) {
    return new NextResponse("name is required", { status: 400 });
  }

  const dir = assetsDir(params.type, params.slug);
  fs.mkdirSync(dir, { recursive: true });
  const md = buildMarkdown({
    name: String(data.name),
    developer: data.developer ? String(data.developer) : undefined,
    category: data.category ? String(data.category) : undefined,
    tagline: data.tagline ? String(data.tagline) : undefined,
    description: data.description ? String(data.description) : undefined,
    website: data.website ? String(data.website) : undefined,
    tags: Array.isArray(data.tags) ? data.tags.map(String) : undefined,
    body: typeof data.body === "string" ? data.body : undefined,
  });
  fs.writeFileSync(infoFile(params.type, params.slug), md, "utf8");
  return NextResponse.json({ ok: true });
}
