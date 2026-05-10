import { Clock, Eye, Search } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	useAnalyticsOverview,
	useContentViewsAnalytics,
	useViewSessionsAnalytics,
} from "@/hooks/analytics/use-analytics";
import type { ContentType } from "@/lib/types/content";

function formatDuration(seconds: number) {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	if (h > 0) {
		return `${h}h ${m}m`;
	}
	return `${m}m`;
}

function formatDate(date: Date | string) {
	return new Date(date).toLocaleString();
}

const TYPE_COLOR: Record<ContentType, string> = {
	MOVIE: "bg-blue-100 text-blue-600",
	SERIES: "bg-purple-100 text-purple-600",
	EPISODE: "bg-indigo-100 text-indigo-600",
	MUSIC: "bg-pink-100 text-pink-600",
};

function getWatchDurationValue(
	isLoading: boolean,
	overview: { totalWatchDuration: number } | undefined
): string {
	if (isLoading) {
		return "—";
	}
	if (overview) {
		return formatDuration(overview.totalWatchDuration);
	}
	return "0m";
}

function ContentViewsBody({
	isLoading,
	items,
}: {
	isLoading: boolean;
	items:
		| NonNullable<ReturnType<typeof useContentViewsAnalytics>["data"]>["items"]
		| undefined;
}) {
	if (isLoading) {
		return (
			<div className="py-12 text-center text-muted-foreground text-sm">
				Loading...
			</div>
		);
	}
	if (!items || items.length === 0) {
		return (
			<div className="py-12 text-center text-muted-foreground text-sm">
				No data available
			</div>
		);
	}
	return (
		<>
			{items.map((item) => (
				<div
					className="grid grid-cols-[2fr_100px_80px_100px] items-center gap-4 border-b px-6 py-4 transition-colors last:border-0 hover:bg-muted/30"
					key={item.contentId}
				>
					<p className="truncate font-medium text-sm">{item.title}</p>
					<Badge
						className={`w-fit text-xs capitalize ${TYPE_COLOR[item.contentType]}`}
						variant="outline"
					>
						{item.contentType.toLowerCase()}
					</Badge>
					<span className="text-muted-foreground text-sm">
						{item.aggregatedViews.toLocaleString()}
					</span>
					<span className="text-muted-foreground text-sm">
						{formatDuration(item.aggregatedWatchDuration)}
					</span>
				</div>
			))}
		</>
	);
}

function ViewSessionsBody({
	isLoading,
	items,
}: {
	isLoading: boolean;
	items:
		| NonNullable<ReturnType<typeof useViewSessionsAnalytics>["data"]>["items"]
		| undefined;
}) {
	if (isLoading) {
		return (
			<div className="py-12 text-center text-muted-foreground text-sm">
				Loading...
			</div>
		);
	}
	if (!items || items.length === 0) {
		return (
			<div className="py-12 text-center text-muted-foreground text-sm">
				No sessions yet
			</div>
		);
	}
	return (
		<>
			{items.map((session) => (
				<div
					className="grid grid-cols-[1fr_1fr_80px_100px] items-center gap-4 border-b px-6 py-4 transition-colors last:border-0 hover:bg-muted/30"
					key={session.id}
				>
					<span className="text-muted-foreground text-sm">
						{formatDate(session.viewedAt)}
					</span>
					<code className="truncate text-muted-foreground text-xs">
						{session.contentId.slice(0, 12)}...
					</code>
					<span className="text-muted-foreground text-sm">
						{session.watchDuration
							? formatDuration(session.watchDuration)
							: "—"}
					</span>
					<Badge className="w-fit text-xs capitalize" variant="outline">
						{session.deviceType ?? "unknown"}
					</Badge>
				</div>
			))}
		</>
	);
}

export default function AnalyticsDashboard() {
	const [search, setSearch] = useState("");
	const [contentPage, setContentPage] = useState(1);
	const [sessionPage, setSessionPage] = useState(1);

	const [from] = useState(() => {
		const d = new Date();
		d.setDate(d.getDate() - 30);
		return d;
	});
	const [to] = useState(() => new Date());

	const { data: overview, isLoading: overviewLoading } = useAnalyticsOverview(
		from,
		to
	);
	const { data: contentViews, isLoading: contentLoading } =
		useContentViewsAnalytics(contentPage, search, from, to);
	const { data: viewSessions, isLoading: sessionLoading } =
		useViewSessionsAnalytics(sessionPage, from, to);

	const kpiCards = [
		{
			icon: Eye,
			label: "Total Views",
			value: overviewLoading
				? "—"
				: (overview?.totalViews.toLocaleString() ?? "0"),
			sub: "Last 30 days",
		},
		{
			icon: Clock,
			label: "Watch Duration",
			value: getWatchDurationValue(overviewLoading, overview),
			sub: "Last 30 days",
		},
	];

	return (
		<div className="space-y-6">
			{/* KPI Cards */}
			<div className="grid grid-cols-2 gap-4">
				{kpiCards.map((stat) => (
					<div
						className="flex items-center gap-4 rounded-xl border bg-card p-5"
						key={stat.label}
					>
						<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
							<stat.icon className="text-primary" size={22} />
						</div>
						<div>
							<p className="text-muted-foreground text-sm">{stat.label}</p>
							<p className="font-bold text-2xl">{stat.value}</p>
							<p className="text-muted-foreground text-xs">{stat.sub}</p>
						</div>
					</div>
				))}
			</div>

			{/* Content Views */}
			<div className="rounded-xl border bg-card">
				<div className="flex items-center justify-between border-b px-6 py-4">
					<h2 className="font-semibold">Content Views</h2>
					<div className="relative w-64">
						<Search
							className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
							size={14}
						/>
						<Input
							className="h-8 pl-8 text-sm"
							onChange={(e) => {
								setSearch(e.target.value);
								setContentPage(1);
							}}
							placeholder="Search content..."
							value={search}
						/>
					</div>
				</div>
				<div className="grid grid-cols-[2fr_100px_80px_100px] gap-4 border-b px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
					<span>Content</span>
					<span>Type</span>
					<span>Views</span>
					<span>Watch Time</span>
				</div>
				<ContentViewsBody
					isLoading={contentLoading}
					items={contentViews?.items}
				/>
				<div className="flex items-center justify-between px-6 py-3">
					<span className="text-muted-foreground text-xs">
						{contentViews?.pagination.total ?? 0} items
					</span>
					<div className="flex items-center gap-1">
						<Button
							className="h-8 w-8"
							disabled={contentPage === 1}
							onClick={() => setContentPage((p) => p - 1)}
							size="icon"
							type="button"
							variant="ghost"
						>
							{"<"}
						</Button>
						{Array.from(
							{ length: contentViews?.pagination.totalPages ?? 1 },
							(_, i) => i + 1
						).map((p) => (
							<Button
								className="h-8 w-8 text-xs"
								key={p}
								onClick={() => setContentPage(p)}
								size="icon"
								type="button"
								variant={p === contentPage ? "default" : "ghost"}
							>
								{p}
							</Button>
						))}
						<Button
							className="h-8 w-8"
							disabled={
								contentPage === (contentViews?.pagination.totalPages ?? 1)
							}
							onClick={() => setContentPage((p) => p + 1)}
							size="icon"
							type="button"
							variant="ghost"
						>
							{">"}
						</Button>
					</div>
				</div>
			</div>

			{/* View Sessions */}
			<div className="rounded-xl border bg-card">
				<div className="border-b px-6 py-4">
					<h2 className="font-semibold">View Sessions</h2>
					<p className="mt-0.5 text-muted-foreground text-xs">
						Individual viewing sessions
					</p>
				</div>
				<div className="grid grid-cols-[1fr_1fr_80px_100px] gap-4 border-b px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
					<span>Viewed At</span>
					<span>Content ID</span>
					<span>Duration</span>
					<span>Device</span>
				</div>
				<ViewSessionsBody
					isLoading={sessionLoading}
					items={viewSessions?.items}
				/>
				<div className="flex items-center justify-between px-6 py-3">
					<span className="text-muted-foreground text-xs">
						{viewSessions?.pagination.total ?? 0} sessions
					</span>
					<div className="flex items-center gap-1">
						<Button
							className="h-8 w-8"
							disabled={sessionPage === 1}
							onClick={() => setSessionPage((p) => p - 1)}
							size="icon"
							type="button"
							variant="ghost"
						>
							{"<"}
						</Button>
						{Array.from(
							{ length: viewSessions?.pagination.totalPages ?? 1 },
							(_, i) => i + 1
						).map((p) => (
							<Button
								className="h-8 w-8 text-xs"
								key={p}
								onClick={() => setSessionPage(p)}
								size="icon"
								type="button"
								variant={p === sessionPage ? "default" : "ghost"}
							>
								{p}
							</Button>
						))}
						<Button
							className="h-8 w-8"
							disabled={
								sessionPage === (viewSessions?.pagination.totalPages ?? 1)
							}
							onClick={() => setSessionPage((p) => p + 1)}
							size="icon"
							type="button"
							variant="ghost"
						>
							{">"}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
