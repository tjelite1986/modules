import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchBiltemTerm, type BiltemSearchResult } from "@/lib/biltema";

export const dynamic = "force-dynamic";

// Representative search terms covering Biltema's catalog.
const TERMS = [
  "skiftnyckel", "skruvmejsel", "hammare", "tång", "hovtång",
  "borr", "sågblad", "fil", "mejsel", "stämjärn",
  "lampa", "led", "spotlight", "lykta", "ficklampa",
  "batteri", "kabel", "kontakt", "säkring", "laddare",
  "handske", "skyddsglasögon", "hörselskydd", "andningsskydd",
  "skruv", "mutter", "bult", "spik", "plugg",
  "målarpensel", "roller", "spackel", "silikon", "lim",
  "pump", "kedja", "cykellås", "cykellyse", "sadel",
  "motorolja", "bromsvätska", "kylarvätska", "vindrutesprej",
  "ryggsäck", "termos", "sovsäck", "tält", "fiskespö",
  "grep", "spade", "kratta", "vattenkanna", "slang",
  "vattenfilter", "timer", "sensor", "dimmer",
  "städmop", "handduk", "korg", "hink",
  "träbit", "skena", "profil", "vinkel",
];

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const result: T[] = [];
  while (result.length < n && copy.length > 0) {
    const i = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(i, 1)[0]);
  }
  return result;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const count = Math.min(
    Math.max(parseInt(request.nextUrl.searchParams.get("count") ?? "20"), 1),
    100,
  );

  const terms = pickRandom(TERMS, 4);
  const perTerm = Math.ceil(count / 2);

  const batches = await Promise.all(
    terms.map((t) => fetchBiltemTerm(t, { cache: "no-store", take: perTerm })),
  );

  // Combine, dedupe by article number, shuffle
  const seen = new Set<string>();
  const all: BiltemSearchResult[] = [];
  for (const batch of batches) {
    for (const item of batch) {
      if (!seen.has(item.articleNumber)) {
        seen.add(item.articleNumber);
        all.push(item);
      }
    }
  }

  // Fisher-Yates shuffle
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }

  return NextResponse.json(all.slice(0, count));
}
