import {
	getAnalyticsOverview,
	listContentViewsAnalytics,
	listViewSessionsAnalytics,
} from "@/modules/analytics/analytics.service";
import {
	analyticsContentViewsInputSchema,
	analyticsContentViewsOutputSchema,
	analyticsOverviewInputSchema,
	analyticsOverviewOutputSchema,
	analyticsViewSessionsInputSchema,
	analyticsViewSessionsOutputSchema,
} from "@/modules/analytics/analytics.validators";
import { adminProcedure, router } from "@/orpc";

export const analyticsRouter = router({
	overview: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/analytics/overview",
			tags: ["Analytics"],
			summary: "Get analytics overview",
			description: "Requires admin or superadmin role.",
		})
		.input(analyticsOverviewInputSchema.optional())
		.output(analyticsOverviewOutputSchema)
		.handler(({ context, input }) => {
			return getAnalyticsOverview({
				db: context.db,
				input: analyticsOverviewInputSchema.parse(input ?? {}),
			});
		}),
	contentViews: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/analytics/contentViews",
			tags: ["Analytics"],
			summary: "List analytics by content",
			description: "Requires admin or superadmin role.",
		})
		.input(analyticsContentViewsInputSchema.optional())
		.output(analyticsContentViewsOutputSchema)
		.handler(({ context, input }) => {
			return listContentViewsAnalytics({
				db: context.db,
				input: analyticsContentViewsInputSchema.parse(input ?? {}),
			});
		}),
	viewSessions: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/analytics/viewSessions",
			tags: ["Analytics"],
			summary: "List analytics view sessions",
			description: "Requires admin or superadmin role.",
		})
		.input(analyticsViewSessionsInputSchema.optional())
		.output(analyticsViewSessionsOutputSchema)
		.handler(({ context, input }) => {
			return listViewSessionsAnalytics({
				db: context.db,
				input: analyticsViewSessionsInputSchema.parse(input ?? {}),
			});
		}),
});
