import { NextRequest, NextResponse } from "next/server";

/**
 * Single-article lookup by article number. Public — no auth required, since
 * this is a public catalog. Add a session check if you only want signed-in
 * users to be able to look up.
 */
export async function GET(request: NextRequest) {
  const articleNumber = request.nextUrl.searchParams.get("article_number");
  if (!articleNumber) {
    return NextResponse.json({ error: "article_number is required" }, { status: 400 });
  }

  const query = articleNumber.replace(/-/g, "");

  try {
    const res = await fetch(
      `https://find.biltema.com/v3/web/typeahead/100/sv/${query}?IsFilterEnabled=true&Take=1`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return NextResponse.json(null);

    const data = await res.json();
    if (!data.totalNumberOfHits) return NextResponse.json(null);

    const doc = data.documents[0];
    return NextResponse.json({
      name: doc.name || "",
      price: typeof doc.priceRaw === "number" ? doc.priceRaw : null,
    });
  } catch {
    return NextResponse.json(null);
  }
}
