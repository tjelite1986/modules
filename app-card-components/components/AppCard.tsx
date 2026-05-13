import Link from "next/link";
import type { AppEntry } from "@/lib/store";
import { Package } from "lucide-react";
import { InstallButton } from "@/components/InstallButton";

function detailHref(entry: AppEntry) {
  return `/${entry.type === "apps" ? "app" : "game"}/${encodeURIComponent(entry.slug)}`;
}

function logoUrlOf(entry: AppEntry) {
  return entry.hasLogo ? `/api/asset/${entry.type}/${encodeURIComponent(entry.slug)}/logo` : null;
}

function bannerUrlOf(entry: AppEntry) {
  return entry.hasBanner ? `/api/asset/${entry.type}/${encodeURIComponent(entry.slug)}/banner` : null;
}

/** Square icon card – used in dense grids ("New apps"). */
export function AppCard({ entry }: { entry: AppEntry }) {
  const href = detailHref(entry);
  const logoUrl = logoUrlOf(entry);
  return (
    <Link href={href} className="group flex flex-col gap-2 p-2 rounded-xl hover:bg-zinc-900 transition">
      <div className="aspect-square w-full rounded-2xl overflow-hidden bg-zinc-800">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={entry.meta.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600">
            <Package className="w-1/3 h-1/3" />
          </div>
        )}
      </div>
      <div className="px-1">
        <div className="font-semibold text-sm truncate">{entry.meta.name}</div>
        <div className="text-xs text-zinc-500 truncate">
          {entry.meta.category || entry.meta.developer || (entry.type === "apps" ? "App" : "Game")}
        </div>
      </div>
    </Link>
  );
}

/** Compact horizontal card with logo + meta + Install button (Play Store list-style). */
export function AppRowCard({ entry }: { entry: AppEntry }) {
  const href = detailHref(entry);
  const logoUrl = logoUrlOf(entry);
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl hover:bg-zinc-900 transition">
      <Link href={href} className="flex items-center gap-3 min-w-0 flex-1 group">
        <div className="w-14 h-14 shrink-0 rounded-2xl overflow-hidden bg-zinc-800">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={entry.meta.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600">
              <Package className="w-7 h-7" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{entry.meta.name}</div>
          <div className="text-xs text-zinc-500 truncate">
            {[entry.meta.developer, entry.meta.category].filter(Boolean).join(" · ") ||
              (entry.type === "apps" ? "App" : "Game")}
          </div>
        </div>
      </Link>
      <InstallButton entry={entry} size="sm" />
    </div>
  );
}

/** Landscape banner card with hero image + small icon row underneath ("Suggested for you"). */
export function AppLandscapeCard({ entry }: { entry: AppEntry }) {
  const href = detailHref(entry);
  const banner = bannerUrlOf(entry);
  const logo = logoUrlOf(entry);
  return (
    <Link
      href={href}
      className="group block w-[260px] sm:w-[300px] shrink-0 snap-start"
    >
      <div className="aspect-[16/10] w-full rounded-2xl overflow-hidden bg-zinc-800 relative">
        {banner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={banner} alt="" className="w-full h-full object-cover group-hover:scale-[1.02] transition" />
        ) : logo ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="" className="w-1/2 h-1/2 object-contain rounded-2xl" />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600">
            <Package className="w-12 h-12" />
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 mt-3 px-1">
        <div className="w-10 h-10 shrink-0 rounded-xl overflow-hidden bg-zinc-800">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600">
              <Package className="w-5 h-5" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate">{entry.meta.name}</div>
          <div className="text-xs text-zinc-500 truncate">
            {entry.meta.category || entry.meta.developer || (entry.type === "apps" ? "App" : "Game")}
          </div>
        </div>
      </div>
    </Link>
  );
}

/** Big featured hero card at top of home. */
export function HeroCard({ entry }: { entry: AppEntry }) {
  const href = detailHref(entry);
  const banner = bannerUrlOf(entry);
  const logo = logoUrlOf(entry);
  return (
    <div>
      <Link href={href} className="group block">
        <div className="aspect-[16/9] sm:aspect-[21/9] w-full rounded-2xl overflow-hidden bg-zinc-800 relative">
          {banner ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={banner} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-black flex items-center justify-center">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="w-32 h-32 rounded-3xl object-cover" />
              ) : (
                <Package className="w-20 h-20 text-zinc-600" />
              )}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent p-4 sm:p-6">
            <div className="text-white font-bold text-xl sm:text-2xl drop-shadow">
              {entry.meta.tagline || `Featured: ${entry.meta.name}`}
            </div>
            {entry.meta.description && (
              <div className="text-zinc-200 text-sm mt-1 line-clamp-2 max-w-2xl">
                {entry.meta.description}
              </div>
            )}
          </div>
        </div>
      </Link>
      <AppRowCard entry={entry} />
    </div>
  );
}

/** Backwards-compat alias for AppRowCard. */
export function AppCardWide({ entry }: { entry: AppEntry }) {
  return <AppRowCard entry={entry} />;
}
