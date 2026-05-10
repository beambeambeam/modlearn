import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookOpen, Clock, Eye, Film, Upload } from "lucide-react";
import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import BarYAxis from "@/components/charts/bar-y-axis";
import { Grid } from "@/components/charts/grid";
import { Line, LineChart } from "@/components/charts/line-chart";
import { ChartTooltip } from "@/components/charts/tooltip";
import { XAxis } from "@/components/charts/x-axis";
import {
	useAnalyticsOverview,
	useContentViewsAnalytics,
	useViewSessionsAnalytics,
} from "@/hooks/analytics/use-analytics";
import { useContents } from "@/hooks/content/use-content";

export const Route = createFileRoute("/_admin-layout/admin/dashboard")({
	component: AdminDashboardPage,
});

function formatDuration(seconds: number) {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const MOCK_DAILY_VIEWS = [
	{ date: new Date("2026-04-16"), views: 12 },
	{ date: new Date("2026-04-17"), views: 28 },
	{ date: new Date("2026-04-18"), views: 19 },
	{ date: new Date("2026-04-19"), views: 35 },
	{ date: new Date("2026-04-20"), views: 42 },
	{ date: new Date("2026-04-21"), views: 31 },
	{ date: new Date("2026-04-22"), views: 58 },
];

const MOCK_TOP_CONTENT = [
	{ name: "Web Dev Masterclass", views: 4821 },
	{ name: "Python for Data Science", views: 3102 },
	{ name: "React Native Bootcamp", views: 2890 },
	{ name: "CSS Grid Deep Dive", views: 2341 },
	{ name: "TypeScript Deep Dive", views: 1500 },
];

function AdminDashboardPage() {
	const navigate = useNavigate();

	const { data: overview } = useAnalyticsOverview();
	const { data: contents } = useContents(1, "", undefined);
	const { data: contentViews } = useContentViewsAnalytics(1, "");
	const { data: viewSessions } = useViewSessionsAnalytics(1);

	const dailyViewsData = (() => {
		if (!viewSessions?.items.length) {
			return MOCK_DAILY_VIEWS;
		}
		const grouped: Record<string, number> = {};
		for (const s of viewSessions.items) {
			const key = new Date(s.viewedAt).toISOString().split("T")[0];
			grouped[key] = (grouped[key] ?? 0) + 1;
		}
		return Object.entries(grouped)
			.map(([dateStr, views]) => ({ date: new Date(dateStr), views }))
			.sort((a, b) => a.date.getTime() - b.date.getTime())
			.slice(-7);
	})();

	const topContentData = (() => {
		if (!contentViews?.items.length) {
			return MOCK_TOP_CONTENT;
		}
		return contentViews.items.slice(0, 5).map((c) => ({
			name: c.title.length > 20 ? `${c.title.slice(0, 20)}...` : c.title,
			views: c.aggregatedViews,
		}));
	})();

	return (
		<div className="space-y-6">
			<h1 className="font-bold text-2xl">Dashboard</h1>

			{/* KPI Cards */}
			<div className="grid grid-cols-3 gap-4">
				{[
					{
						icon: Eye,
						label: "Total Views",
						value: overview?.totalViews.toLocaleString() ?? "—",
						sub: "All time",
					},
					{
						icon: Clock,
						label: "Watch Duration",
						value: overview ? formatDuration(overview.totalWatchDuration) : "—",
						sub: "All time",
					},
					{
						icon: Film,
						label: "Total Content",
						value: contents?.pagination.total.toLocaleString() ?? "—",
						sub: "All content",
					},
				].map((stat) => (
					<div
						className="space-y-1 rounded-xl border bg-card p-5"
						key={stat.label}
					>
						<div className="flex items-center justify-between">
							<p className="text-muted-foreground text-sm">{stat.label}</p>
							<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
								<stat.icon className="text-primary" size={16} />
							</div>
						</div>
						<p className="font-bold text-2xl">{stat.value}</p>
						<p className="text-muted-foreground text-xs">{stat.sub}</p>
					</div>
				))}
			</div>

			{/* Charts Row */}
			<div className="grid grid-cols-2 gap-6">
				<div className="rounded-xl border bg-card p-6">
					<h2 className="mb-1 font-semibold">Daily Views</h2>
					<p className="mb-4 text-muted-foreground text-xs">
						View sessions over the last 7 days
					</p>
					<LineChart aspectRatio="2 / 1" data={dailyViewsData} xDataKey="date">
						<Grid horizontal vertical={false} />
						<Line dataKey="views" fadeEdges={false} strokeWidth={2.5} />
						<XAxis numTicks={7} />
						<ChartTooltip showDatePill />
					</LineChart>
				</div>

				<div className="rounded-xl border bg-card p-6">
					<h2 className="mb-1 font-semibold">Top Content</h2>
					<p className="mb-4 text-muted-foreground text-xs">
						Most viewed content items
					</p>
					<BarChart
						aspectRatio="2 / 1"
						data={topContentData}
						margin={{ top: 20, right: 20, bottom: 20, left: 80 }}
						orientation="horizontal"
						xDataKey="name"
					>
						<Grid horizontal vertical={false} />
						<Bar
							animationType="grow"
							dataKey="views"
							fill="var(--chart-line-primary)"
							lineCap="round"
						/>
						<BarYAxis />
						<ChartTooltip showDatePill={false} />
					</BarChart>
				</div>
			</div>

			{/* Quick Actions */}
			<div className="rounded-xl border bg-card p-6">
				<h2 className="mb-4 font-semibold">Quick Actions</h2>
				<div className="grid grid-cols-3 gap-3">
					{[
						{
							icon: Film,
							label: "New Content",
							sub: "Add video, audio, or article",
							to: "/admin/content/new",
						},
						{
							icon: BookOpen,
							label: "New Playlist",
							sub: "Create a new course or series",
							to: "/admin/playlists/new",
						},
						{
							icon: Upload,
							label: "Upload File",
							sub: "Upload media files",
							to: "/admin/files",
						},
					].map((action) => (
						<button
							className="flex items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted/30"
							key={action.label}
							onClick={() => navigate({ to: action.to })}
							type="button"
						>
							<action.icon className="shrink-0 text-primary" size={18} />
							<div>
								<p className="font-medium text-sm">{action.label}</p>
								<p className="text-muted-foreground text-xs">{action.sub}</p>
							</div>
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
