import DashboardShell from "@/components/DashboardShell";
import TagsClient from "./TagsClient";

export const dynamic = "force-dynamic";

export default function GalleryTagsPage() {
  return (
    <DashboardShell>
      <TagsClient />
    </DashboardShell>
  );
}
