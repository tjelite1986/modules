import DashboardShell from "@/components/DashboardShell";
import TripsClient from "./TripsClient";

export const dynamic = "force-dynamic";

export default function GalleryTripsPage() {
  return (
    <DashboardShell>
      <TripsClient />
    </DashboardShell>
  );
}
