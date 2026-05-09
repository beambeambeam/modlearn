import { useState } from "react";
import { Eye, Clock, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useAnalyticsOverview,
  useContentViewsAnalytics,
  useViewSessionsAnalytics,
} from "@/hooks/analytics/use-analytics";
import type { ContentType } from "@/lib/types/content";

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleString();
}

const TYPE_COLOR: Record<ContentType, string> = {
  MOVIE:   "bg-blue-100 text-blue-600",
  SERIES:  "bg-purple-100 text-purple-600",
  EPISODE: "bg-indigo-100 text-indigo-600",
  MUSIC:   "bg-pink-100 text-pink-600",
};

function getWatchDurationValue(
  isLoading: boolean,
  overview: { totalWatchDuration: number } | undefined
): string {
  if (isLoading) return "—";
  if (overview) return formatDuration(overview.totalWatchDuration);
  return "0m";
}

function ContentViewsBody({
  isLoading,
  items,
}: {
  isLoading: boolean;
  items: NonNullable<ReturnType<typeof useContentViewsAnalytics>["data"]>["items"] | undefined;
}) {
  if (isLoading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>;
  if (!items || items.length === 0) return <div className="py-12 text-center text-sm text-muted-foreground">No data available</div>;
  return (
    <>
      {items.map((item) => (
        <div
          key={item.contentId}
          className="grid grid-cols-[2fr_100px_80px_100px] gap-4 items-center px-6 py-4 border-b last:border-0 hover:bg-muted/30 transition-colors"
        >
          <p className="text-sm font-medium truncate">{item.title}</p>
          <Badge variant="outline" className={`capitalize text-xs w-fit ${TYPE_COLOR[item.contentType]}`}>
            {item.contentType.toLowerCase()}
          </Badge>
          <span className="text-sm text-muted-foreground">{item.aggregatedViews.toLocaleString()}</span>
          <span className="text-sm text-muted-foreground">{formatDuration(item.aggregatedWatchDuration)}</span>
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
  items: NonNullable<ReturnType<typeof useViewSessionsAnalytics>["data"]>["items"] | undefined;
}) {
  if (isLoading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>;
  if (!items || items.length === 0) return <div className="py-12 text-center text-sm text-muted-foreground">No sessions yet</div>;
  return (
    <>
      {items.map((session) => (
        <div
          key={session.id}
          className="grid grid-cols-[1fr_1fr_80px_100px] gap-4 items-center px-6 py-4 border-b last:border-0 hover:bg-muted/30 transition-colors"
        >
          <span className="text-sm text-muted-foreground">{formatDate(session.viewedAt)}</span>
          <code className="text-xs text-muted-foreground truncate">{session.contentId.slice(0, 12)}...</code>
          <span className="text-sm text-muted-foreground">{session.watchDuration ? formatDuration(session.watchDuration) : "—"}</span>
          <Badge variant="outline" className="text-xs w-fit capitalize">{session.deviceType ?? "unknown"}</Badge>
        </div>
      ))}
    </>
  );
}

export default function AnalyticsDashboard() {
  const [search, setSearch]           = useState("");
  const [contentPage, setContentPage] = useState(1);
  const [sessionPage, setSessionPage] = useState(1);

  const [from] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  });
  const [to] = useState(() => new Date());

  const { data: overview, isLoading: overviewLoading }    = useAnalyticsOverview(from, to);
  const { data: contentViews, isLoading: contentLoading } = useContentViewsAnalytics(contentPage, search, from, to);
  const { data: viewSessions, isLoading: sessionLoading } = useViewSessionsAnalytics(sessionPage, from, to);

  const kpiCards = [
    {
      icon: Eye,
      label: "Total Views",
      value: overviewLoading ? "—" : (overview?.totalViews.toLocaleString() ?? "0"),
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
          <div key={stat.label} className="rounded-xl border bg-card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <stat.icon size={22} className="text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Content Views */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold">Content Views</h2>
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search content..."
              className="pl-8 h-8 text-sm"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setContentPage(1); }}
            />
          </div>
        </div>
        <div className="grid grid-cols-[2fr_100px_80px_100px] gap-4 px-6 py-3 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <span>Content</span><span>Type</span><span>Views</span><span>Watch Time</span>
        </div>
        <ContentViewsBody isLoading={contentLoading} items={contentViews?.items} />
        <div className="flex items-center justify-between px-6 py-3">
          <span className="text-xs text-muted-foreground">{contentViews?.pagination.total ?? 0} items</span>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={contentPage === 1} onClick={() => setContentPage((p) => p - 1)}>{"<"}</Button>
            {Array.from({ length: contentViews?.pagination.totalPages ?? 1 }, (_, i) => i + 1).map((p) => (
              <Button type="button" key={p} variant={p === contentPage ? "default" : "ghost"} size="icon" className="h-8 w-8 text-xs" onClick={() => setContentPage(p)}>{p}</Button>
            ))}
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={contentPage === (contentViews?.pagination.totalPages ?? 1)} onClick={() => setContentPage((p) => p + 1)}>{">"}</Button>
          </div>
        </div>
      </div>

      {/* View Sessions */}
      <div className="rounded-xl border bg-card">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold">View Sessions</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Individual viewing sessions</p>
        </div>
        <div className="grid grid-cols-[1fr_1fr_80px_100px] gap-4 px-6 py-3 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <span>Viewed At</span><span>Content ID</span><span>Duration</span><span>Device</span>
        </div>
        <ViewSessionsBody isLoading={sessionLoading} items={viewSessions?.items} />
        <div className="flex items-center justify-between px-6 py-3">
          <span className="text-xs text-muted-foreground">{viewSessions?.pagination.total ?? 0} sessions</span>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={sessionPage === 1} onClick={() => setSessionPage((p) => p - 1)}>{"<"}</Button>
            {Array.from({ length: viewSessions?.pagination.totalPages ?? 1 }, (_, i) => i + 1).map((p) => (
              <Button type="button" key={p} variant={p === sessionPage ? "default" : "ghost"} size="icon" className="h-8 w-8 text-xs" onClick={() => setSessionPage(p)}>{p}</Button>
            ))}
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={sessionPage === (viewSessions?.pagination.totalPages ?? 1)} onClick={() => setSessionPage((p) => p + 1)}>{">"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}