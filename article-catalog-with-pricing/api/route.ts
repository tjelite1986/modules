import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { eq, asc, or, like } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q");
  const result = q
    ? await db
        .select()
        .from(articles)
        .where(
          or(
            like(articles.articleNumber, `%${q}%`),
            like(articles.name, `%${q}%`),
            like(articles.category, `%${q}%`),
          ),
        )
        .orderBy(asc(articles.articleNumber))
    : await db.select().from(articles).orderBy(asc(articles.articleNumber));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body.articleNumber?.trim() || !body.name?.trim()) {
    return NextResponse.json(
      { error: "articleNumber and name are required" },
      { status: 400 },
    );
  }

  try {
    const [article] = await db
      .insert(articles)
      .values({
        articleNumber: body.articleNumber.trim(),
        name: body.name.trim(),
        price: body.price != null && body.price !== "" ? parseFloat(String(body.price)) : null,
        bundleQuantity:
          body.bundleQuantity != null && body.bundleQuantity !== ""
            ? parseInt(String(body.bundleQuantity))
            : null,
        bundlePrice:
          body.bundlePrice != null && body.bundlePrice !== ""
            ? parseFloat(String(body.bundlePrice))
            : null,
        category: body.category?.trim() || null,
        description: body.description?.trim() || null,
      })
      .returning();
    return NextResponse.json(article, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("UNIQUE")) {
      return NextResponse.json({ error: "Article number already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "Id is required" }, { status: 400 });

  try {
    await db
      .update(articles)
      .set({
        articleNumber: body.articleNumber?.trim(),
        name: body.name?.trim(),
        price: body.price != null && body.price !== "" ? parseFloat(String(body.price)) : null,
        bundleQuantity:
          body.bundleQuantity != null && body.bundleQuantity !== ""
            ? parseInt(String(body.bundleQuantity))
            : null,
        bundlePrice:
          body.bundlePrice != null && body.bundlePrice !== ""
            ? parseFloat(String(body.bundlePrice))
            : null,
        category: body.category?.trim() || null,
        description: body.description?.trim() || null,
      })
      .where(eq(articles.id, body.id));
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("UNIQUE")) {
      return NextResponse.json({ error: "Article number already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Id is required" }, { status: 400 });

  await db.delete(articles).where(eq(articles.id, parseInt(id)));
  return NextResponse.json({ ok: true });
}
