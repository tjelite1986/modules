/**
 * Adapter for Biltema's public typeahead search API. Biltema is a
 * Nordic chain selling tools, hardware, automotive, etc. The endpoint
 * returns up to 100 documents per request and supports an "IsFilterEnabled"
 * filter to drop documents without article IDs.
 */

const BILTEMA_BASE = "https://find.biltema.com/v3/web/typeahead/100/sv";

/** Strip HTML tags from a string and collapse whitespace. */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

export interface BiltemDoc {
  name?: string;
  priceRaw?: number;
  areaName?: string;
  description?: string;
  firstArticleChild?: string;
  articles?: string[];
  articleData?: { articleId: string; name: string; priceRaw?: number }[];
}

export interface BiltemSearchResult {
  articleNumber: string;
  name: string;
  price: number | null;
  category: string | null;
  description: string | null;
}

/** Flatten Biltema documents into normalised search results. */
export function flattenDocuments(documents: BiltemDoc[]): BiltemSearchResult[] {
  return documents.flatMap((doc) => {
    const articleData =
      Array.isArray(doc.articleData) && doc.articleData.length > 0
        ? doc.articleData
        : [
            {
              articleId: doc.firstArticleChild ?? doc.articles?.[0] ?? "",
              name: doc.name ?? "",
              priceRaw: doc.priceRaw ?? 0,
            },
          ];

    return articleData
      .filter((a) => a.articleId)
      .map((a) => ({
        articleNumber: String(a.articleId),
        name: a.name || doc.name || "",
        price: typeof a.priceRaw === "number" && a.priceRaw > 0 ? a.priceRaw : null,
        category: doc.areaName ?? null,
        description: doc.description ? stripHtml(doc.description).slice(0, 250) : null,
      }));
  });
}

export interface BiltemFetchOptions {
  /** Cache strategy: 'revalidate' | 'no-store' */
  cache?: "revalidate" | "no-store";
  /** Seconds for revalidate (default 300). Ignored if cache='no-store'. */
  revalidateSeconds?: number;
  /** Max number of results returned (default 20, max 50). */
  take?: number;
}

/** Fetch documents matching a query term. */
export async function fetchBiltemTerm(
  term: string,
  opts: BiltemFetchOptions = {},
): Promise<BiltemSearchResult[]> {
  const take = Math.min(opts.take ?? 20, 50);
  const url = `${BILTEMA_BASE}/${encodeURIComponent(term)}?IsFilterEnabled=true&Take=${take}`;
  const fetchOpts: RequestInit =
    opts.cache === "no-store"
      ? { cache: "no-store" }
      : { next: { revalidate: opts.revalidateSeconds ?? 300 } };

  try {
    const res = await fetch(url, fetchOpts);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      totalNumberOfHits?: number;
      documents?: BiltemDoc[];
    };
    if (!data.totalNumberOfHits || !Array.isArray(data.documents)) return [];
    return flattenDocuments(data.documents);
  } catch {
    return [];
  }
}
