import { listType, type AppEntry } from "@/lib/store";
import { Header } from "@/components/Header";
import { AppCard, AppRowCard, AppLandscapeCard, HeroCard } from "@/components/AppCard";
import { Section } from "@/components/Section";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";

function pickHero(entries: AppEntry[]): AppEntry | null {
  const banners = entries.filter((e) => e.hasBanner);
  const pool = banners.length > 0 ? banners : entries.filter((e) => e.hasLogo && e.meta.tagline);
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

export default function HomePage() {
  const apps = listType("apps");
  const games = listType("games");
  const all = [...apps, ...games];

  if (all.length === 0) {
    return (
      <div>
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <EmptyState
            title="No apps or games yet"
            description="Create a folder under $STORE_ROOT/apps or $STORE_ROOT/games and it will show up here. Use Admin to add the logo and description."
          />
        </main>
      </div>
    );
  }

  const hero = pickHero(all);
  const recentApps = [...apps].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
  const recentGames = [...games].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
  const suggestedApps = [...apps]
    .filter((e) => e.slug !== hero?.slug && (e.hasBanner || e.hasLogo))
    .sort(() => Math.random() - 0.5)
    .slice(0, 6);
  const featuredApps = [...apps]
    .filter((e) => e.hasLogo && e.slug !== hero?.slug)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 4);

  return (
    <div>
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {hero && (
          <section className="mb-8">
            <HeroCard entry={hero} />
          </section>
        )}

        {suggestedApps.length > 0 && (
          <Section title="Suggested for you">
            <div className="flex gap-4 overflow-x-auto snap-x pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
              {suggestedApps.map((e) => (
                <AppLandscapeCard key={`${e.type}-${e.slug}`} entry={e} />
              ))}
            </div>
          </Section>
        )}

        {featuredApps.length > 0 && (
          <Section title="Top picks">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
              {featuredApps.map((e) => (
                <AppRowCard key={`${e.type}-${e.slug}`} entry={e} />
              ))}
            </div>
          </Section>
        )}

        {recentApps.length > 0 && (
          <Section title="New apps" href="/apps">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1">
              {recentApps.map((e) => (
                <AppCard key={e.slug} entry={e} />
              ))}
            </div>
          </Section>
        )}

        {recentGames.length > 0 && (
          <Section title="New games" href="/games">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1">
              {recentGames.map((e) => (
                <AppCard key={e.slug} entry={e} />
              ))}
            </div>
          </Section>
        )}
      </main>
    </div>
  );
}
