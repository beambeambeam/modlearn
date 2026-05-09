import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function useAnalyticsOverview(from?: Date, to?: Date) {
  return useQuery(
    orpc.analytics.overview.queryOptions({
      input: { activeWindowMinutes: 15, from, to },
    })
  );
}

export function useContentViewsAnalytics(
  page: number,
  search: string,
  from?: Date,
  to?: Date
) {
  return useQuery({
    ...orpc.analytics.contentViews.queryOptions({
      input: {
        page,
        limit: 10,
        search: search.trim() || undefined,
        from,
        to,
      },
    }),
    placeholderData: (prev) => prev,
  });
}

export function useViewSessionsAnalytics(page: number, from?: Date, to?: Date) {
  return useQuery({
    ...orpc.analytics.viewSessions.queryOptions({
      input: { page, limit: 10, from, to },
    }),
    placeholderData: (prev) => prev,
  });
}