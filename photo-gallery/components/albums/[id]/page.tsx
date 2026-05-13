import DashboardShell from "@/components/DashboardShell";
import AlbumClient from "./AlbumClient";

export const dynamic = "force-dynamic";

export default function AlbumPage({ params }: { params: { id: string } }) {
  return (
    <DashboardShell>
      <AlbumClient albumId={parseInt(params.id, 10)} />
    </DashboardShell>
  );
}
