import DashboardShell from "@/components/DashboardShell";
import TripDetailClient from "./TripDetailClient";

export const dynamic = "force-dynamic";

export default function TripDetailPage({ params }: { params: { id: string } }) {
  return (
    <DashboardShell>
      <TripDetailClient tripId={parseInt(params.id, 10)} />
    </DashboardShell>
  );
}
