import DashboardShell from "@/components/DashboardShell";
import GalleryClient from "./GalleryClient";

export const dynamic = "force-dynamic";

export default function GalleryPage() {
  return (
    <DashboardShell>
      <GalleryClient />
    </DashboardShell>
  );
}
