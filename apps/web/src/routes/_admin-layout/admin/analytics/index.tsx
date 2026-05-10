import { createFileRoute } from "@tanstack/react-router";
import AnalyticsDashboard from "@/components/admin/analytics/analytics-dashboard";

export const Route = createFileRoute("/_admin-layout/admin/analytics/")({
	component: AnalyticsPage,
});

function AnalyticsPage() {
	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-bold text-2xl">Analytics</h1>
				<p className="mt-1 text-muted-foreground">
					Platform performance and content insights.
				</p>
			</div>
			<AnalyticsDashboard />
		</div>
	);
}
