import DashboardShell from "@/components/DashboardShell";
import SectionTabs from "@/components/SectionTabs";
import AdminGate from "@/components/AdminGate";
import { instaeliteTabs } from "@/lib/sectionTabs";

export default function InstaeliteLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell>
      <AdminGate>
        <SectionTabs tabs={instaeliteTabs} />
        {children}
      </AdminGate>
    </DashboardShell>
  );
}
