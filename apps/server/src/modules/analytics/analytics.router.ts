import {
	getAnalyticsOverview,
	listCourseLessonEngagementAnalytics,
	listCoursePerformanceAnalytics,
	listInstructorBreakdownAnalytics,
	listLessonViewsAnalytics,
	listViewSessionsAnalytics,
} from "@/modules/analytics/analytics.service";
import {
	analyticsCourseLessonEngagementInputSchema,
	analyticsCourseLessonEngagementOutputSchema,
	analyticsCoursePerformanceInputSchema,
	analyticsCoursePerformanceOutputSchema,
	analyticsInstructorBreakdownInputSchema,
	analyticsInstructorBreakdownOutputSchema,
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
	instructorBreakdown: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/analytics/instructorBreakdown",
			tags: ["Analytics Admin"],
			summary: "List Instructor Analytics Breakdown",
			description:
				"Requires admin or superadmin role. Returns creator-level analytics for the requested scope, window, and sort order.",
		})
		.input(analyticsInstructorBreakdownInputSchema.optional())
		.output(analyticsInstructorBreakdownOutputSchema)
		.handler(({ context, input }) => {
			return listInstructorBreakdownAnalytics({
				db: context.db,
				input: analyticsInstructorBreakdownInputSchema.parse(input ?? {}),
			});
		}),
	coursePerformance: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/analytics/coursePerformance",
			tags: ["Analytics Admin"],
			summary: "List Course Performance Analytics",
			description:
				"Requires admin or superadmin role. Returns per-course instructor analytics for the requested scope, window, and sort order.",
		})
		.input(analyticsCoursePerformanceInputSchema.optional())
		.output(analyticsCoursePerformanceOutputSchema)
		.handler(({ context, input }) => {
			return listCoursePerformanceAnalytics({
				db: context.db,
				input: analyticsCoursePerformanceInputSchema.parse(input ?? {}),
			});
		}),
	courseLessonEngagement: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/analytics/courseLessonEngagement",
			tags: ["Analytics Admin"],
			summary: "List Course Lesson Engagement Analytics",
			description:
				"Requires admin or superadmin role. Returns course-scoped lesson engagement metrics including completion and drop-off.",
		})
		.input(analyticsCourseLessonEngagementInputSchema)
		.output(analyticsCourseLessonEngagementOutputSchema)
		.handler(({ context, input }) => {
			return listCourseLessonEngagementAnalytics({
				db: context.db,
				input: analyticsCourseLessonEngagementInputSchema.parse(input),
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
