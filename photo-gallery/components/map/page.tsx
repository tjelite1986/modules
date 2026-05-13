import DashboardShell from "@/components/DashboardShell";
import MapClient from "./MapClient";

export const dynamic = "force-dynamic";

export default function GalleryMapPage() {
  return (
    <DashboardShell>
      <MapClient />
    </DashboardShell>
  );
}
