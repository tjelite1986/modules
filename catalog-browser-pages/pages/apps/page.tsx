import { listType } from "@/lib/store";
import { Header } from "@/components/Header";
import { CatalogGrid } from "@/components/CatalogGrid";

export const dynamic = "force-dynamic";

export default function AppsPage() {
  const apps = listType("apps");
  return (
    <div>
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <h1 className="text-2xl font-bold mb-4">Apps</h1>
        <CatalogGrid entries={apps} emptyTitle="No apps yet" />
      </main>
    </div>
  );
}
