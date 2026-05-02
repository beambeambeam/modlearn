import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, Clock, Film, Upload, BookOpen, ClipboardList } from "lucide-react";
import {
  useAnalyticsOverview,
  useContentViewsAnalytics,
  useViewSessionsAnalytics,
} from "@/hooks/analytics/use-analytics";
import { useContents } from "@/hooks/content/use-content";
import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import BarYAxis from "@/components/charts/bar-y-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { LineChart, Line } from "@/components/charts/line-chart";
import { XAxis } from "@/components/charts/x-axis";

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
  { name: "Web Dev Masterclass",     views: 4821 },
  { name: "Python for Data Science", views: 3102 },
  { name: "React Native Bootcamp",   views: 2890 },
  { name: "CSS Grid Deep Dive",      views: 2341 },
  { name: "TypeScript Deep Dive",    views: 1500 },
];

function AdminDashboardPage() {
  const navigate = useNavigate();

  const { data: overview }     = useAnalyticsOverview();
  const { data: contents }     = useContents(1, "", undefined);
  const { data: contentViews } = useContentViewsAnalytics(1, "");
  const { data: viewSessions } = useViewSessionsAnalytics(1);

  const dailyViewsData = (() => {
    if (!viewSessions?.items.length) return MOCK_DAILY_VIEWS;
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
    if (!contentViews?.items.length) return MOCK_TOP_CONTENT;
    return contentViews.items.slice(0, 5).map((c) => ({
      name:  c.title.length > 20 ? `${c.title.slice(0, 20)}...` : c.title,
      views: c.aggregatedViews,
    }));
  })();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Eye,   label: "Total Views",    value: overview?.totalViews.toLocaleString() ?? "—",                 sub: "All time"    },
          { icon: Clock, label: "Watch Duration", value: overview ? formatDuration(overview.totalWatchDuration) : "—", sub: "All time"    },
          { icon: Film,  label: "Total Content",  value: contents?.pagination.total.toLocaleString() ?? "—",          sub: "All content" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border bg-card p-5 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <stat.icon size={16} className="text-primary" />
              </div>
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-xl border bg-card p-6">
          <h2 className="font-semibold mb-1">Daily Views</h2>
          <p className="text-xs text-muted-foreground mb-4">View sessions over the last 7 days</p>
          <LineChart data={dailyViewsData} xDataKey="date" aspectRatio="2 / 1">
            <Grid horizontal vertical={false} />
            <Line dataKey="views" strokeWidth={2.5} fadeEdges={false} />
            <XAxis numTicks={7} />
            <ChartTooltip showDatePill />
          </LineChart>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h2 className="font-semibold mb-1">Top Content</h2>
          <p className="text-xs text-muted-foreground mb-4">Most viewed content items</p>
          <BarChart
            data={topContentData}
            xDataKey="name"
            aspectRatio="2 / 1"
            orientation="horizontal"
            margin={{ top: 20, right: 20, bottom: 20, left: 80 }}
          >
            <Grid horizontal vertical={false} />
            <Bar dataKey="views" fill="var(--chart-line-primary)" lineCap="round" animationType="grow" />
            <BarYAxis />
            <ChartTooltip showDatePill={false} />
          </BarChart>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl border bg-card p-6">
        <h2 className="font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Film,          label: "New Content",  sub: "Add video, audio, or article", to: "/admin/content/new"   },
            { icon: BookOpen,      label: "New Playlist", sub: "Create a new course or series", to: "/admin/playlists/new" },
            { icon: Upload,        label: "Upload File",  sub: "Upload media files",            to: "/admin/files"         },
          ].map((action) => (
            <button
              type="button"
              key={action.label}
              onClick={() => navigate({ to: action.to })}
              className="flex items-center gap-3 rounded-lg border p-4 hover:bg-muted/30 transition-colors text-left"
            >
              <action.icon size={18} className="text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">{action.label}</p>
                <p className="text-xs text-muted-foreground">{action.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}