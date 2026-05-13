import { listAll } from "@/lib/store";
import { Header } from "@/components/Header";
import { AppRowCard } from "@/components/AppCard";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q || "").trim().toLowerCase();
  const entries = listAll();
  const results = q
    ? entries.filter((e) => {
        const hay = [
          e.meta.name,
          e.slug,
          e.meta.developer,
          e.meta.category,
          e.meta.tagline,
          e.meta.description,
          ...(e.meta.tags || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
    : [];

  return (
    <div>
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <h1 className="text-2xl font-bold mb-1">Search</h1>
        <p className="text-sm text-zinc-400 mb-6">
          {q ? <>Results for <span className="text-white">{q}</span></> : "Type something in the search field."}
        </p>
        {q && results.length === 0 ? (
          <EmptyState title="No matches" description="Try a different search term." />
        ) : (
          <div className="space-y-1">
            {results.map((e) => (
              <AppRowCard key={`${e.type}-${e.slug}`} entry={e} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
