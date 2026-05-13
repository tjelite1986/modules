import type { AppVersion } from "@/lib/store";
import { formatBytes, ARCH_LABELS } from "@/lib/store";
import { Download } from "lucide-react";

export function VersionList({
  type,
  slug,
  versions,
}: {
  type: string;
  slug: string;
  versions: AppVersion[];
}) {
  if (versions.length === 0) {
    return <p className="text-sm text-zinc-500">No versions uploaded yet.</p>;
  }
  return (
    <ul className="divide-y divide-zinc-800/60 rounded-xl bg-zinc-900 border border-zinc-800/50">
      {versions.map((v, i) => (
        <li key={v.version} className="p-4 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">v{v.version}</span>
              {i === 0 && (
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 font-bold">
                  Latest
                </span>
              )}
              <span className="text-xs text-zinc-500">{formatBytes(v.totalSize)}</span>
            </div>
            <div className="mt-1.5 space-y-0.5">
              {v.files.map((f) => (
                <a
                  key={`${f.versionDir}/${f.name}`}
                  href={`/api/download/${type}/${encodeURIComponent(slug)}/${encodeURIComponent(f.versionDir)}/${encodeURIComponent(f.name)}`}
                  className="flex items-center justify-between gap-2 text-sm text-zinc-300 hover:text-indigo-400 transition group"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="truncate">{f.name}</span>
                    {f.arch !== "universal" && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-bold shrink-0">
                        {ARCH_LABELS[f.arch]}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-zinc-500 group-hover:text-indigo-400 shrink-0">
                    <Download className="w-3.5 h-3.5" />
                    {formatBytes(f.size)}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
