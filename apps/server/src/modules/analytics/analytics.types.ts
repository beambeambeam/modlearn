import type { DbClient } from "@/lib/db/orm";

export interface AnalyticsDateRangeInput {
	from?: Date;
	to?: Date;
}

export interface AnalyticsScopedInput extends AnalyticsDateRangeInput {
	courseId?: string;
}

export interface AnalyticsPaginationInput {
	page?: number;
	limit?: number;
}

export type AnalyticsSortDirection = "asc" | "desc";

export interface AnalyticsOverviewInput extends AnalyticsScopedInput {}

export interface AnalyticsLessonViewsInput
	extends AnalyticsScopedInput,
		AnalyticsPaginationInput {
	search?: string;
}

export interface AnalyticsViewSessionsInput
	extends AnalyticsScopedInput,
		AnalyticsPaginationInput {
	userId?: string;
	courseLessonId?: string;
}

export type AnalyticsCoursePerformanceSortBy =
	| "netRevenue"
	| "totalEnrollments"
	| "activeEnrollments"
	| "learnersStarted"
	| "activationRate"
	| "courseCompletions"
	| "completionRate"
	| "totalViews"
	| "averageRating"
	| "publishedAt";

export interface AnalyticsCoursePerformanceInput
	extends AnalyticsScopedInput,
		AnalyticsPaginationInput {
	search?: string;
	sortBy?: AnalyticsCoursePerformanceSortBy;
	sortDirection?: AnalyticsSortDirection;
}

export type AnalyticsCourseLessonEngagementSortBy =
	| "lessonOrder"
	| "totalViews"
	| "uniqueViewers"
	| "learnersStarted"
	| "completionRate"
	| "dropOffRate"
	| "avgProgressPercent";

export interface AnalyticsCourseLessonEngagementInput
	extends AnalyticsDateRangeInput,
		AnalyticsPaginationInput {
	courseId: string;
	search?: string;
	sortBy?: AnalyticsCourseLessonEngagementSortBy;
	sortDirection?: AnalyticsSortDirection;
}

export interface AnalyticsOverviewResult {
	totalViews: number;
	totalWatchDuration: number;
	uniqueViewers: number;
	totalCourses: number;
	publishedCourses: number;
	totalEnrollments: number;
	activeEnrollments: number;
	learnersStarted: number;
	courseCompletions: number;
	grossRevenue: number;
	refundedRevenue: number;
	netRevenue: number;
	visibleReviewCount: number;
	averageRating: number | null;
	generatedAt: Date;
}

export interface AnalyticsLessonViewItem {
	courseLessonId: string;
	courseId: string;
	courseTitle: string;
	title: string;
	aggregatedViews: number;
	aggregatedWatchDuration: number;
}

export interface AnalyticsViewSessionItem {
	id: string;
	courseLessonId: string;
	userId: string | null;
	viewedAt: Date;
	watchDuration: number | null;
	deviceType: string | null;
}

export interface AnalyticsCoursePerformanceItem {
	courseId: string;
	courseTitle: string;
	isPublished: boolean;
	isAvailable: boolean;
	publishedAt: Date | null;
	lessonCount: number;
	totalEnrollments: number;
	activeEnrollments: number;
	learnersStarted: number;
	activationRate: number;
	courseCompletions: number;
	completionRate: number;
	totalViews: number;
	totalWatchDuration: number;
	averageWatchDurationPerViewer: number;
	grossRevenue: number;
	refundedRevenue: number;
	netRevenue: number;
	visibleReviewCount: number;
	averageRating: number | null;
}

export interface AnalyticsCourseLessonEngagementItem {
	courseLessonId: string;
	courseId: string;
	courseTitle: string;
	lessonOrder: number;
	title: string;
	duration: number | null;
	totalViews: number;
	uniqueViewers: number;
	learnersStarted: number;
	learnersCompleted: number;
	completionRate: number;
	avgProgressPercent: number;
	dropOffRate: number;
	aggregatedWatchDuration: number;
}

export interface AnalyticsPagination {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
}

export interface AnalyticsLessonViewsResult {
	items: AnalyticsLessonViewItem[];
	pagination: AnalyticsPagination;
}

export interface AnalyticsViewSessionsResult {
	items: AnalyticsViewSessionItem[];
	pagination: AnalyticsPagination;
}

export interface AnalyticsCoursePerformanceResult {
	items: AnalyticsCoursePerformanceItem[];
	pagination: AnalyticsPagination;
}

export interface AnalyticsCourseLessonEngagementResult {
	items: AnalyticsCourseLessonEngagementItem[];
	pagination: AnalyticsPagination;
}

export interface AnalyticsOverviewParams {
	db: DbClient;
	input: AnalyticsOverviewInput;
}

export interface AnalyticsLessonViewsParams {
	db: DbClient;
	input: AnalyticsLessonViewsInput;
}

export interface AnalyticsViewSessionsParams {
	db: DbClient;
	input: AnalyticsViewSessionsInput;
}

export interface AnalyticsCoursePerformanceParams {
	db: DbClient;
	input: AnalyticsCoursePerformanceInput;
}

export interface AnalyticsCourseLessonEngagementParams {
	db: DbClient;
	input: AnalyticsCourseLessonEngagementInput;
}
