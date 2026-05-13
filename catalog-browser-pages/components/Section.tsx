import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function Section({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {href && (
          <Link href={href} className="text-sm text-indigo-400 hover:underline flex items-center">
            See all
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
