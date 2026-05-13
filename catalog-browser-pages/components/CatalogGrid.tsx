"use client";

import { useMemo, useState } from "react";
import type { AppEntry } from "@/lib/store";
import { AppRowCard } from "@/components/AppCard";
import { CategoryFilter } from "@/components/CategoryFilter";
import { EmptyState } from "@/components/EmptyState";

export function CatalogGrid({ entries, emptyTitle }: { entries: AppEntry[]; emptyTitle: string }) {
  const [category, setCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      if (e.meta.category) set.add(e.meta.category);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "en"));
  }, [entries]);

  const filtered = useMemo(() => {
    if (!category) return entries;
    return entries.filter((e) => e.meta.category === category);
  }, [entries, category]);

  if (entries.length === 0) {
    return <EmptyState title={emptyTitle} description="Create a folder and fill in the info via Admin." />;
  }

  return (
    <>
      <CategoryFilter categories={categories} active={category} onChange={setCategory} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-1 mt-4">
        {filtered.map((e) => (
          <AppRowCard key={e.slug} entry={e} />
        ))}
      </div>
    </>
  );
}
