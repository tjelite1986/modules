import DashboardShell from "@/components/DashboardShell";
import SmartAlbumRedirect from "./SmartAlbumRedirect";

export const dynamic = "force-dynamic";

export default function SmartAlbumPage({ params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  return (
    <DashboardShell>
      <SmartAlbumRedirect id={Number.isFinite(id) ? id : 0} />
    </DashboardShell>
  );
}
