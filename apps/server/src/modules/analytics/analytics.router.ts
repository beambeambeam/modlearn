import {
	getAnalyticsOverview,
	listLessonViewsAnalytics,
	listViewSessionsAnalytics,
} from "@/modules/analytics/analytics.service";
import {
	analyticsLessonViewsInputSchema,
	analyticsLessonViewsOutputSchema,
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
			tags: ["Analytics Admin"],
			summary: "Retrieve Analytics Overview Metrics",
			description:
				"Requires admin or superadmin role. Returns aggregated platform metrics for the requested window.",
		})
		.input(analyticsOverviewInputSchema.optional())
		.output(analyticsOverviewOutputSchema)
		.handler(({ context, input }) => {
			return getAnalyticsOverview({
				db: context.db,
				input: analyticsOverviewInputSchema.parse(input ?? {}),
			});
		}),
	lessonViews: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/analytics/lessonViews",
			tags: ["Analytics Admin"],
			summary: "List Lesson View Analytics",
			description:
				"Requires admin or superadmin role. Returns per-lesson view analytics for the requested window and filters.",
		})
		.input(analyticsLessonViewsInputSchema.optional())
		.output(analyticsLessonViewsOutputSchema)
		.handler(({ context, input }) => {
			return listLessonViewsAnalytics({
				db: context.db,
				input: analyticsLessonViewsInputSchema.parse(input ?? {}),
			});
		}),
	viewSessions: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/analytics/viewSessions",
			tags: ["Analytics Admin"],
			summary: "List View Session Analytics",
			description:
				"Requires admin or superadmin role. Returns lesson view session analytics for the requested window and filters.",
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
