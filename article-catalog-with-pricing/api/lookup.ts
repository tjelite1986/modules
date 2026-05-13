import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json(null, { status: 401 });

  const articleNumber = request.nextUrl.searchParams.get("article_number");
  if (!articleNumber) return NextResponse.json(null);

  const clean = articleNumber.replace(/-/g, "").trim();
  const [article] = await db
    .select()
    .from(articles)
    .where(eq(articles.articleNumber, clean))
    .limit(1);

  if (!article) return NextResponse.json(null);

  return NextResponse.json({
    name: article.name,
    price: article.price,
    bundleQuantity: article.bundleQuantity,
    bundlePrice: article.bundlePrice,
  });
}
