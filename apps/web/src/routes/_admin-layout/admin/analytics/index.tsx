import { createFileRoute } from "@tanstack/react-router";
import AnalyticsDashboard from "@/components/admin/analytics/analytics-dashboard";

export const Route = createFileRoute("/_admin-layout/admin/analytics/")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Platform performance and content insights.
        </p>
      </div>
      <AnalyticsDashboard />
    </div>
  );
}