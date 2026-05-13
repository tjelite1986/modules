import Link from "next/link";
import type { AppEntry } from "@/lib/store";

export function InstallButton({
  entry,
  size = "md",
}: {
  entry: AppEntry;
  size?: "sm" | "md";
}) {
  const slug = encodeURIComponent(entry.slug);
  const latest = entry.latest;
  const primary = latest?.primaryFile ?? null;
  const href = primary
    ? `/api/download/${entry.type}/${slug}/${encodeURIComponent(primary.versionDir)}/${encodeURIComponent(primary.name)}`
    : null;

  const detailHref = `/${entry.type === "apps" ? "app" : "game"}/${slug}`;
  const cls =
    size === "sm" ? "px-4 py-1.5 text-xs" : "px-5 py-2 text-sm";

  if (!href) {
    return (
      <Link
        href={detailHref}
        className={`${cls} rounded-full bg-zinc-800 text-zinc-400 font-semibold whitespace-nowrap`}
      >
        Open
      </Link>
    );
  }

  return (
    <a
      href={href}
      className={`${cls} rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold whitespace-nowrap transition`}
    >
      Install
    </a>
  );
}
