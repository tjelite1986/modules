import DashboardShell from "@/components/DashboardShell";
import YearReviewClient from "./YearReviewClient";

export const dynamic = "force-dynamic";

export default function YearReviewPage({ params }: { params: { year: string } }) {
  const year = parseInt(params.year, 10);
  return (
    <DashboardShell>
      <YearReviewClient year={Number.isFinite(year) ? year : new Date().getFullYear()} />
    </DashboardShell>
  );
}
