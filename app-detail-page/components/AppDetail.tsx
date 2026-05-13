import type { AppEntry, AppFile } from "@/lib/store";
import { formatBytes, ARCH_LABELS } from "@/lib/store";
import { Download, Package, ExternalLink } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import { Screenshots } from "@/components/Screenshots";
import { VersionList } from "@/components/VersionList";

const APK_RE = /\.(apk|xapk|apks|obb|zip)$/i;

function pickInstallables(files: AppFile[]): AppFile[] {
  const apks = files.filter((f) => APK_RE.test(f.name));
  if (apks.length === 0) return [];
  const byArch = new Map<string, AppFile>();
  for (const f of apks) {
    const cur = byArch.get(f.arch);
    if (!cur || f.size > cur.size) byArch.set(f.arch, f);
  }
  const order = ["arm64", "arm32", "x86_64", "x86", "universal"];
  return Array.from(byArch.values()).sort(
    (a, b) => order.indexOf(a.arch) - order.indexOf(b.arch),
  );
}

export function AppDetail({ entry }: { entry: AppEntry }) {
  const slug = encodeURIComponent(entry.slug);
  const logoUrl = entry.hasLogo ? `/api/asset/${entry.type}/${slug}/logo` : null;
  const latest = entry.latest;
  const installables = latest ? pickInstallables(latest.files) : [];
  const showArch = installables.length > 1;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex flex-col sm:flex-row gap-6 items-start mb-8">
        <div className="w-32 h-32 rounded-3xl overflow-hidden bg-zinc-800 shrink-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={entry.meta.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600">
              <Package className="w-12 h-12" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">{entry.meta.name}</h1>
          {entry.meta.developer && (
            <div className="text-indigo-400 text-sm mt-1">{entry.meta.developer}</div>
          )}
          {entry.meta.tagline && (
            <p className="text-zinc-400 mt-2">{entry.meta.tagline}</p>
          )}

          <div className="flex flex-wrap gap-3 text-xs text-zinc-500 mt-3">
            {entry.meta.category && (
              <span className="px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800">
                {entry.meta.category}
              </span>
            )}
            {latest && (
              <span>v{latest.version} · {formatBytes(latest.totalSize)}</span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-5">
            {installables.length === 0 || !latest ? (
              <span className="inline-flex items-center gap-2 bg-zinc-900 text-zinc-500 px-6 py-2.5 rounded-full">
                No file available
              </span>
            ) : (
              installables.map((f) => (
                <a
                  key={`${f.versionDir}/${f.name}`}
                  href={`/api/download/${entry.type}/${slug}/${encodeURIComponent(f.versionDir)}/${encodeURIComponent(f.name)}`}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-2.5 rounded-full transition"
                >
                  <Download className="w-4 h-4" />
                  {showArch ? `Install ${ARCH_LABELS[f.arch]}` : "Install"}
                  <span className="text-white/60 text-xs font-normal">
                    {formatBytes(f.size)}
                  </span>
                </a>
              ))
            )}
            {entry.meta.website && (
              <a
                href={entry.meta.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border border-zinc-700 hover:border-zinc-500 px-4 py-2.5 rounded-full transition text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                Website
              </a>
            )}
          </div>
        </div>
      </div>

      {entry.screenshots.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3">Screenshots</h2>
          <Screenshots type={entry.type} slug={entry.slug} files={entry.screenshots} />
        </section>
      )}

      {(entry.meta.description || entry.meta.body) && (
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3">About</h2>
          {entry.meta.description && (
            <p className="text-zinc-300 mb-4">{entry.meta.description}</p>
          )}
          {entry.meta.body && <Markdown>{entry.meta.body}</Markdown>}
        </section>
      )}

      {entry.meta.tags && entry.meta.tags.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3">Tags</h2>
          <div className="flex flex-wrap gap-2">
            {entry.meta.tags.map((t) => (
              <span key={t} className="px-3 py-1 rounded-full bg-zinc-900 text-sm text-zinc-300 border border-zinc-800">
                #{t}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="mb-10">
        <h2 className="text-lg font-bold mb-3">Versions</h2>
        <VersionList type={entry.type} slug={entry.slug} versions={entry.versions} />
      </section>
    </div>
  );
}
