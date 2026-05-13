import { notFound } from "next/navigation";
import { readEntry, decodeSlug } from "@/lib/store";
import { Header } from "@/components/Header";
import { AppDetail } from "@/components/AppDetail";

export const dynamic = "force-dynamic";

export default function GamePage({ params }: { params: { slug: string } }) {
  const slug = decodeSlug(params.slug);
  const entry = readEntry("games", slug);
  if (!entry) notFound();
  return (
    <div>
      <Header />
      <AppDetail entry={entry} />
    </div>
  );
}
