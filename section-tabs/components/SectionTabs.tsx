"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface SectionTab {
  href: string;
  label: string;
  matchPrefix?: string;
}

export default function SectionTabs({
  tabs,
  className,
}: {
  tabs: SectionTab[];
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <div
      className={`flex gap-1 border-b border-dark-border mb-4 -mx-1 px-1 overflow-x-auto ${
        className ?? ""
      }`}
    >
      {tabs.map((t) => {
        const prefix = t.matchPrefix ?? t.href;
        const active = pathname === t.href || pathname.startsWith(prefix + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              active
                ? "text-white border-blue-500"
                : "text-gray-400 border-transparent hover:text-gray-200"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
