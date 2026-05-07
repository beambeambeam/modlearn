import { z } from "zod";

const paginationInputSchema = z.object({
	page: z.number().int().min(1).default(1),
	limit: z.number().int().min(1).max(100).default(20),
});

const dateRangeInputSchema = z.object({
	from: z.date().optional(),
	to: z.date().optional(),
});

const scopedInputSchema = dateRangeInputSchema.extend({
	courseId: z.uuid().optional(),
});

const sortDirectionSchema = z.enum(["asc", "desc"]);

const coursePerformanceSortBySchema = z.enum([
	"netRevenue",
	"totalEnrollments",
	"activeEnrollments",
	"learnersStarted",
	"activationRate",
	"courseCompletions",
	"completionRate",
	"totalViews",
	"averageRating",
	"publishedAt",
]);

const courseLessonEngagementSortBySchema = z.enum([
	"lessonOrder",
	"totalViews",
	"uniqueViewers",
	"learnersStarted",
	"completionRate",
	"dropOffRate",
	"avgProgressPercent",
]);

export const analyticsOverviewInputSchema = scopedInputSchema;

export const analyticsLessonViewsInputSchema = scopedInputSchema.extend({
	page: paginationInputSchema.shape.page,
	limit: paginationInputSchema.shape.limit,
	search: z.string().trim().min(1).optional(),
});

export const analyticsViewSessionsInputSchema = scopedInputSchema.extend({
	page: paginationInputSchema.shape.page,
	limit: paginationInputSchema.shape.limit,
	userId: z.string().trim().min(1).optional(),
	courseLessonId: z.uuid().optional(),
});

export const analyticsCoursePerformanceInputSchema = scopedInputSchema.extend({
	page: paginationInputSchema.shape.page,
	limit: paginationInputSchema.shape.limit,
	search: z.string().trim().min(1).optional(),
	sortBy: coursePerformanceSortBySchema.default("netRevenue"),
	sortDirection: sortDirectionSchema.default("desc"),
});

export const analyticsCourseLessonEngagementInputSchema =
	dateRangeInputSchema.extend({
		page: paginationInputSchema.shape.page,
		limit: paginationInputSchema.shape.limit,
		courseId: z.uuid(),
		search: z.string().trim().min(1).optional(),
		sortBy: courseLessonEngagementSortBySchema.default("lessonOrder"),
		sortDirection: sortDirectionSchema.default("asc"),
	});

export const analyticsPaginationSchema = z.object({
	page: z.number().int(),
	limit: z.number().int(),
	total: z.number().int(),
	totalPages: z.number().int(),
});

export const analyticsOverviewOutputSchema = z.object({
	totalViews: z.number().int(),
	totalWatchDuration: z.number().int(),
	uniqueViewers: z.number().int(),
	totalCourses: z.number().int(),
	publishedCourses: z.number().int(),
	totalEnrollments: z.number().int(),
	activeEnrollments: z.number().int(),
	learnersStarted: z.number().int(),
	courseCompletions: z.number().int(),
	grossRevenue: z.number(),
	refundedRevenue: z.number(),
	netRevenue: z.number(),
	visibleReviewCount: z.number().int(),
	averageRating: z.number().nullable(),
	generatedAt: z.date(),
});

export const analyticsLessonViewsOutputSchema = z.object({
	items: z.array(
		z.object({
			courseLessonId: z.uuid(),
			courseId: z.uuid(),
			courseTitle: z.string(),
			title: z.string(),
			aggregatedViews: z.number().int(),
			aggregatedWatchDuration: z.number().int(),
		})
	),
	pagination: analyticsPaginationSchema,
});

export const analyticsViewSessionsOutputSchema = z.object({
	items: z.array(
		z.object({
			id: z.uuid(),
			courseLessonId: z.uuid(),
			userId: z.string().nullable(),
			viewedAt: z.date(),
			watchDuration: z.number().int().nullable(),
			deviceType: z.string().nullable(),
		})
	),
	pagination: analyticsPaginationSchema,
});

export const analyticsCoursePerformanceOutputSchema = z.object({
	items: z.array(
		z.object({
			courseId: z.uuid(),
			courseTitle: z.string(),
			isPublished: z.boolean(),
			isAvailable: z.boolean(),
			publishedAt: z.date().nullable(),
			lessonCount: z.number().int(),
			totalEnrollments: z.number().int(),
			activeEnrollments: z.number().int(),
			learnersStarted: z.number().int(),
			activationRate: z.number(),
			courseCompletions: z.number().int(),
			completionRate: z.number(),
			totalViews: z.number().int(),
			totalWatchDuration: z.number().int(),
			averageWatchDurationPerViewer: z.number().int(),
			grossRevenue: z.number(),
			refundedRevenue: z.number(),
			netRevenue: z.number(),
			visibleReviewCount: z.number().int(),
			averageRating: z.number().nullable(),
		})
	),
	pagination: analyticsPaginationSchema,
});

export const analyticsCourseLessonEngagementOutputSchema = z.object({
	items: z.array(
		z.object({
			courseLessonId: z.uuid(),
			courseId: z.uuid(),
			courseTitle: z.string(),
			lessonOrder: z.number().int(),
			title: z.string(),
			duration: z.number().int().nullable(),
			totalViews: z.number().int(),
			uniqueViewers: z.number().int(),
			learnersStarted: z.number().int(),
			learnersCompleted: z.number().int(),
			completionRate: z.number(),
			avgProgressPercent: z.number(),
			dropOffRate: z.number(),
			aggregatedWatchDuration: z.number().int(),
		})
	),
	pagination: analyticsPaginationSchema,
});
