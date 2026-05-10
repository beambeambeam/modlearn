import type { SQL } from "drizzle-orm";
import {
	and,
	asc,
	count,
	desc,
	eq,
	gte,
	ilike,
	inArray,
	isNull,
	lte,
	or,
	sql,
} from "drizzle-orm";
import {
	course,
	courseLesson,
	courseLessonView,
	coursePurchase,
	courseReview,
	order,
	userLibrary,
	watchProgress,
} from "@/lib/db/schema";
import type {
	AnalyticsCourseLessonEngagementItem,
	AnalyticsCourseLessonEngagementParams,
	AnalyticsCourseLessonEngagementResult,
	AnalyticsCoursePerformanceItem,
	AnalyticsCoursePerformanceParams,
	AnalyticsCoursePerformanceResult,
	AnalyticsLessonViewsParams,
	AnalyticsLessonViewsResult,
	AnalyticsOverviewParams,
	AnalyticsOverviewResult,
	AnalyticsSortDirection,
	AnalyticsViewSessionsParams,
	AnalyticsViewSessionsResult,
} from "./analytics.types";

interface CourseDimensionRow {
	id: string;
	title: string;
	isPublished: boolean;
	isAvailable: boolean;
	publishedAt: Date | null;
}

interface LessonDimensionRow {
	id: string;
	courseId: string;
	courseTitle: string;
	lessonOrder: number;
	title: string;
	duration: number | null;
}

interface CourseViewAggregate {
	totalViews: number;
	totalWatchDuration: number;
	uniqueViewers: number;
}

interface CourseEnrollmentAggregate {
	totalEnrollments: number;
	activeEnrollments: number;
}

interface CourseRevenueAggregate {
	grossRevenue: number;
	refundedRevenue: number;
}

interface CourseReviewAggregate {
	visibleReviewCount: number;
	ratingSum: number;
}

interface CourseProgressAggregate {
	learnersStarted: number;
	courseCompletions: number;
}

interface CourseMetrics {
	lessonCount: number;
	totalViews: number;
	totalWatchDuration: number;
	uniqueViewers: number;
	totalEnrollments: number;
	activeEnrollments: number;
	learnersStarted: number;
	courseCompletions: number;
	grossRevenue: number;
	refundedRevenue: number;
	netRevenue: number;
	visibleReviewCount: number;
	ratingSum: number;
}

interface LessonViewAggregate {
	totalViews: number;
	uniqueViewers: number;
	aggregatedWatchDuration: number;
}

interface LessonProgressAggregate {
	learnersStarted: number;
	learnersCompleted: number;
	avgProgressPercent: number;
}

function toPagination(params: { page: number; limit: number; total: number }) {
	const { page, limit, total } = params;
	return {
		page,
		limit,
		total,
		totalPages: total === 0 ? 0 : Math.ceil(total / limit),
	};
}

function buildWhere(
	conditions: Array<SQL<unknown> | undefined>
): SQL<unknown> | undefined {
	const filtered = conditions.filter((condition) => condition !== undefined);
	if (filtered.length === 0) {
		return undefined;
	}

	return and(...filtered);
}

function buildCourseScopeWhere(params: {
	courseId?: string;
}): SQL<unknown> | undefined {
	const { courseId } = params;
	return buildWhere([
		eq(course.isDeleted, false),
		courseId ? eq(course.id, courseId) : undefined,
	]);
}

function buildViewDateRangeWhere(params: {
	from?: Date;
	to?: Date;
}): SQL<unknown> | undefined {
	return buildWhere([
		params.from ? gte(courseLessonView.viewedAt, params.from) : undefined,
		params.to ? lte(courseLessonView.viewedAt, params.to) : undefined,
	]);
}

function buildOrderDateRangeWhere(params: {
	from?: Date;
	to?: Date;
}): SQL<unknown> | undefined {
	return buildWhere([
		params.from ? gte(order.createdAt, params.from) : undefined,
		params.to ? lte(order.createdAt, params.to) : undefined,
	]);
}

function buildReviewDateRangeWhere(params: {
	from?: Date;
	to?: Date;
}): SQL<unknown> | undefined {
	return buildWhere([
		params.from ? gte(courseReview.createdAt, params.from) : undefined,
		params.to ? lte(courseReview.createdAt, params.to) : undefined,
	]);
}

function buildWatchProgressDateRangeWhere(params: {
	from?: Date;
	to?: Date;
}): SQL<unknown> | undefined {
	return buildWhere([
		params.from ? gte(watchProgress.updatedAt, params.from) : undefined,
		params.to ? lte(watchProgress.updatedAt, params.to) : undefined,
	]);
}

function normalizeNumber(value: unknown): number {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : 0;
	}
	if (typeof value === "string") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
}

function roundRate(value: number): number {
	return Number(value.toFixed(2));
}

function toAverageRating(params: {
	visibleReviewCount: number;
	ratingSum: number;
}): number | null {
	const { visibleReviewCount, ratingSum } = params;
	if (visibleReviewCount === 0) {
		return null;
	}

	return roundRate(ratingSum / visibleReviewCount);
}

function getCourseMetricDefaults(): CourseMetrics {
	return {
		lessonCount: 0,
		totalViews: 0,
		totalWatchDuration: 0,
		uniqueViewers: 0,
		totalEnrollments: 0,
		activeEnrollments: 0,
		learnersStarted: 0,
		courseCompletions: 0,
		grossRevenue: 0,
		refundedRevenue: 0,
		netRevenue: 0,
		visibleReviewCount: 0,
		ratingSum: 0,
	};
}

function compareValues(
	left: string | number | Date | null,
	right: string | number | Date | null,
	direction: AnalyticsSortDirection
): number {
	const multiplier = direction === "asc" ? 1 : -1;

	if (left === right) {
		return 0;
	}
	if (left === null) {
		return 1;
	}
	if (right === null) {
		return -1;
	}

	if (left instanceof Date && right instanceof Date) {
		return (left.getTime() - right.getTime()) * multiplier;
	}

	if (typeof left === "string" && typeof right === "string") {
		return left.localeCompare(right) * multiplier;
	}

	return (Number(left) - Number(right)) * multiplier;
}

function paginateItems<T>(items: T[], page: number, limit: number): T[] {
	const offset = (page - 1) * limit;
	return items.slice(offset, offset + limit);
}

function listScopedCourses(params: {
	db: AnalyticsOverviewParams["db"];
	courseId?: string;
	search?: string;
}): Promise<CourseDimensionRow[]> {
	const { db, courseId, search } = params;
	return db
		.select({
			id: course.id,
			title: course.title,
			isPublished: course.isPublished,
			isAvailable: course.isAvailable,
			publishedAt: course.publishedAt,
		})
		.from(course)
		.where(
			buildWhere([
				buildCourseScopeWhere({ courseId }),
				search ? ilike(course.title, `%${search.trim()}%`) : undefined,
			])
		)
		.orderBy(asc(course.title), asc(course.id));
}

async function getLessonCountsByCourse(params: {
	db: AnalyticsOverviewParams["db"];
	courseIds: string[];
}): Promise<Map<string, number>> {
	if (params.courseIds.length === 0) {
		return new Map();
	}

	const rows = await params.db
		.select({
			courseId: courseLesson.courseId,
			lessonCount: count(courseLesson.id),
		})
		.from(courseLesson)
		.where(inArray(courseLesson.courseId, params.courseIds))
		.groupBy(courseLesson.courseId);

	return new Map(
		rows.map((row) => [row.courseId, normalizeNumber(row.lessonCount)])
	);
}

async function getCourseViewAggregates(params: {
	db: AnalyticsOverviewParams["db"];
	courseIds: string[];
	from?: Date;
	to?: Date;
}): Promise<Map<string, CourseViewAggregate>> {
	if (params.courseIds.length === 0) {
		return new Map();
	}

	const rows = await params.db
		.select({
			courseId: courseLesson.courseId,
			totalViews: count(courseLessonView.id),
			totalWatchDuration: sql<number>`coalesce(sum(${courseLessonView.watchDuration}), 0)::int`,
			uniqueViewers: sql<number>`count(distinct coalesce(${courseLessonView.userId}, ${courseLessonView.sessionId}))::int`,
		})
		.from(courseLessonView)
		.innerJoin(
			courseLesson,
			eq(courseLessonView.courseLessonId, courseLesson.id)
		)
		.where(
			buildWhere([
				inArray(courseLesson.courseId, params.courseIds),
				buildViewDateRangeWhere(params),
			])
		)
		.groupBy(courseLesson.courseId);

	return new Map(
		rows.map((row) => [
			row.courseId,
			{
				totalViews: normalizeNumber(row.totalViews),
				totalWatchDuration: normalizeNumber(row.totalWatchDuration),
				uniqueViewers: normalizeNumber(row.uniqueViewers),
			},
		])
	);
}

async function getCourseEnrollmentAggregates(params: {
	db: AnalyticsOverviewParams["db"];
	courseIds: string[];
	from?: Date;
	to?: Date;
}): Promise<Map<string, CourseEnrollmentAggregate>> {
	if (params.courseIds.length === 0) {
		return new Map();
	}

	const paidRows = await params.db
		.select({
			courseId: coursePurchase.courseId,
			totalEnrollments: count(coursePurchase.id),
		})
		.from(coursePurchase)
		.innerJoin(order, eq(coursePurchase.orderId, order.id))
		.where(
			buildWhere([
				inArray(coursePurchase.courseId, params.courseIds),
				eq(order.status, "PAID"),
				buildOrderDateRangeWhere(params),
			])
		)
		.groupBy(coursePurchase.courseId);

	const activeRows = await params.db
		.select({
			courseId: userLibrary.courseId,
			activeEnrollments: count(userLibrary.id),
		})
		.from(userLibrary)
		.where(
			buildWhere([
				inArray(userLibrary.courseId, params.courseIds),
				or(
					isNull(userLibrary.expiresAt),
					gte(userLibrary.expiresAt, new Date())
				),
			])
		)
		.groupBy(userLibrary.courseId);

	const results = new Map<string, CourseEnrollmentAggregate>();
	for (const row of paidRows) {
		results.set(row.courseId, {
			totalEnrollments: normalizeNumber(row.totalEnrollments),
			activeEnrollments: 0,
		});
	}

	for (const row of activeRows) {
		const existing = results.get(row.courseId) ?? {
			totalEnrollments: 0,
			activeEnrollments: 0,
		};
		existing.activeEnrollments = normalizeNumber(row.activeEnrollments);
		results.set(row.courseId, existing);
	}

	return results;
}

async function getCourseRevenueAggregates(params: {
	db: AnalyticsOverviewParams["db"];
	courseIds: string[];
	from?: Date;
	to?: Date;
}): Promise<Map<string, CourseRevenueAggregate>> {
	if (params.courseIds.length === 0) {
		return new Map();
	}

	const rows = await params.db
		.select({
			courseId: order.courseId,
			grossRevenue: sql<number>`coalesce(sum(case when ${order.status} = 'PAID' then ${order.totalAmount} else 0 end), 0)::float8`,
			refundedRevenue: sql<number>`coalesce(sum(case when ${order.status} = 'REFUNDED' then ${order.totalAmount} else 0 end), 0)::float8`,
		})
		.from(order)
		.where(
			buildWhere([
				inArray(order.courseId, params.courseIds),
				buildOrderDateRangeWhere(params),
			])
		)
		.groupBy(order.courseId);

	return new Map(
		rows
			.filter(
				(row): row is typeof row & { courseId: string } => row.courseId !== null
			)
			.map((row) => [
				row.courseId,
				{
					grossRevenue: normalizeNumber(row.grossRevenue),
					refundedRevenue: normalizeNumber(row.refundedRevenue),
				},
			])
	);
}

async function getCourseReviewAggregates(params: {
	db: AnalyticsOverviewParams["db"];
	courseIds: string[];
	from?: Date;
	to?: Date;
}): Promise<Map<string, CourseReviewAggregate>> {
	if (params.courseIds.length === 0) {
		return new Map();
	}

	const rows = await params.db
		.select({
			courseId: courseReview.courseId,
			visibleReviewCount: count(courseReview.id),
			ratingSum: sql<number>`coalesce(sum(${courseReview.rating}), 0)::float8`,
		})
		.from(courseReview)
		.where(
			buildWhere([
				inArray(courseReview.courseId, params.courseIds),
				eq(courseReview.isVisible, true),
				buildReviewDateRangeWhere(params),
			])
		)
		.groupBy(courseReview.courseId);

	return new Map(
		rows.map((row) => [
			row.courseId,
			{
				visibleReviewCount: normalizeNumber(row.visibleReviewCount),
				ratingSum: normalizeNumber(row.ratingSum),
			},
		])
	);
}

async function getCourseProgressAggregates(params: {
	db: AnalyticsOverviewParams["db"];
	courseIds: string[];
	from?: Date;
	to?: Date;
}): Promise<Map<string, CourseProgressAggregate>> {
	if (params.courseIds.length === 0) {
		return new Map();
	}

	const progressWhere = buildWhere([
		inArray(watchProgress.courseId, params.courseIds),
		buildWatchProgressDateRangeWhere(params),
	]);

	const learnerRows = await params.db
		.select({
			courseId: watchProgress.courseId,
			learnersStarted: sql<number>`count(distinct ${watchProgress.userId})::int`,
		})
		.from(watchProgress)
		.where(progressWhere)
		.groupBy(watchProgress.courseId);

	const lessonCountSubquery = params.db
		.select({
			courseId: courseLesson.courseId,
			lessonCount: sql<number>`count(${courseLesson.id})::int`.as(
				"lesson_count"
			),
		})
		.from(courseLesson)
		.where(inArray(courseLesson.courseId, params.courseIds))
		.groupBy(courseLesson.courseId)
		.as("lesson_count_by_course");

	const completionRows = await params.db
		.select({
			courseId: watchProgress.courseId,
			userId: watchProgress.userId,
		})
		.from(watchProgress)
		.innerJoin(
			lessonCountSubquery,
			eq(watchProgress.courseId, lessonCountSubquery.courseId)
		)
		.where(progressWhere)
		.groupBy(
			watchProgress.courseId,
			watchProgress.userId,
			lessonCountSubquery.lessonCount
		)
		.having(
			sql`count(distinct case when ${watchProgress.isCompleted} then ${watchProgress.courseLessonId} end) = ${lessonCountSubquery.lessonCount} and ${lessonCountSubquery.lessonCount} > 0`
		);

	const results = new Map<string, CourseProgressAggregate>();
	for (const row of learnerRows) {
		results.set(row.courseId, {
			learnersStarted: normalizeNumber(row.learnersStarted),
			courseCompletions: 0,
		});
	}

	for (const row of completionRows) {
		const existing = results.get(row.courseId) ?? {
			learnersStarted: 0,
			courseCompletions: 0,
		};
		existing.courseCompletions += 1;
		results.set(row.courseId, existing);
	}

	return results;
}

async function getScopedUniqueViewers(params: {
	db: AnalyticsOverviewParams["db"];
	courseId?: string;
	from?: Date;
	to?: Date;
}): Promise<number> {
	const [row] = await params.db
		.select({
			uniqueViewers: sql<number>`count(distinct coalesce(${courseLessonView.userId}, ${courseLessonView.sessionId}))::int`,
		})
		.from(courseLessonView)
		.innerJoin(
			courseLesson,
			eq(courseLessonView.courseLessonId, courseLesson.id)
		)
		.innerJoin(course, eq(courseLesson.courseId, course.id))
		.where(
			buildWhere([
				buildCourseScopeWhere({
					courseId: params.courseId,
				}),
				buildViewDateRangeWhere(params),
			])
		);

	return normalizeNumber(row?.uniqueViewers);
}

async function getScopedLearnersStarted(params: {
	db: AnalyticsOverviewParams["db"];
	courseId?: string;
	from?: Date;
	to?: Date;
}): Promise<number> {
	const [row] = await params.db
		.select({
			learnersStarted: sql<number>`count(distinct ${watchProgress.userId})::int`,
		})
		.from(watchProgress)
		.innerJoin(course, eq(watchProgress.courseId, course.id))
		.where(
			buildWhere([
				buildCourseScopeWhere({
					courseId: params.courseId,
				}),
				buildWatchProgressDateRangeWhere(params),
			])
		);

	return normalizeNumber(row?.learnersStarted);
}

function buildCourseMetricsMap(params: {
	courseIds: string[];
	lessonCounts: Map<string, number>;
	viewAggregates: Map<string, CourseViewAggregate>;
	enrollmentAggregates: Map<string, CourseEnrollmentAggregate>;
	progressAggregates: Map<string, CourseProgressAggregate>;
	revenueAggregates: Map<string, CourseRevenueAggregate>;
	reviewAggregates: Map<string, CourseReviewAggregate>;
}): Map<string, CourseMetrics> {
	const {
		courseIds,
		lessonCounts,
		viewAggregates,
		enrollmentAggregates,
		progressAggregates,
		revenueAggregates,
		reviewAggregates,
	} = params;
	const metrics = new Map<string, CourseMetrics>();

	for (const courseId of courseIds) {
		const next = getCourseMetricDefaults();
		const viewAggregate = viewAggregates.get(courseId);
		const enrollmentAggregate = enrollmentAggregates.get(courseId);
		const progressAggregate = progressAggregates.get(courseId);
		const revenueAggregate = revenueAggregates.get(courseId);
		const reviewAggregate = reviewAggregates.get(courseId);

		next.lessonCount = lessonCounts.get(courseId) ?? 0;
		next.totalViews = viewAggregate?.totalViews ?? 0;
		next.totalWatchDuration = viewAggregate?.totalWatchDuration ?? 0;
		next.uniqueViewers = viewAggregate?.uniqueViewers ?? 0;
		next.totalEnrollments = enrollmentAggregate?.totalEnrollments ?? 0;
		next.activeEnrollments = enrollmentAggregate?.activeEnrollments ?? 0;
		next.learnersStarted = progressAggregate?.learnersStarted ?? 0;
		next.courseCompletions = progressAggregate?.courseCompletions ?? 0;
		next.grossRevenue = revenueAggregate?.grossRevenue ?? 0;
		next.refundedRevenue = revenueAggregate?.refundedRevenue ?? 0;
		next.netRevenue = next.grossRevenue - next.refundedRevenue;
		next.visibleReviewCount = reviewAggregate?.visibleReviewCount ?? 0;
		next.ratingSum = reviewAggregate?.ratingSum ?? 0;

		metrics.set(courseId, next);
	}

	return metrics;
}

async function getLessonViewAggregates(params: {
	db: AnalyticsOverviewParams["db"];
	lessonIds: string[];
	from?: Date;
	to?: Date;
}): Promise<Map<string, LessonViewAggregate>> {
	if (params.lessonIds.length === 0) {
		return new Map();
	}

	const rows = await params.db
		.select({
			courseLessonId: courseLessonView.courseLessonId,
			totalViews: count(courseLessonView.id),
			uniqueViewers: sql<number>`count(distinct coalesce(${courseLessonView.userId}, ${courseLessonView.sessionId}))::int`,
			aggregatedWatchDuration: sql<number>`coalesce(sum(${courseLessonView.watchDuration}), 0)::int`,
		})
		.from(courseLessonView)
		.where(
			buildWhere([
				inArray(courseLessonView.courseLessonId, params.lessonIds),
				buildViewDateRangeWhere(params),
			])
		)
		.groupBy(courseLessonView.courseLessonId);

	return new Map(
		rows.map((row) => [
			row.courseLessonId,
			{
				totalViews: normalizeNumber(row.totalViews),
				uniqueViewers: normalizeNumber(row.uniqueViewers),
				aggregatedWatchDuration: normalizeNumber(row.aggregatedWatchDuration),
			},
		])
	);
}

async function getLessonProgressAggregates(params: {
	db: AnalyticsOverviewParams["db"];
	lessonIds: string[];
	from?: Date;
	to?: Date;
}): Promise<Map<string, LessonProgressAggregate>> {
	if (params.lessonIds.length === 0) {
		return new Map();
	}

	const rows = await params.db
		.select({
			courseLessonId: watchProgress.courseLessonId,
			learnersStarted: sql<number>`count(distinct ${watchProgress.userId})::int`,
			learnersCompleted: sql<number>`count(distinct case when ${watchProgress.isCompleted} then ${watchProgress.userId} end)::int`,
			avgProgressPercent: sql<number>`coalesce(avg(case when ${watchProgress.duration} > 0 then least(${watchProgress.lastPosition}::float8 / ${watchProgress.duration}::float8, 1) * 100 else null end), 0)::float8`,
		})
		.from(watchProgress)
		.where(
			buildWhere([
				inArray(watchProgress.courseLessonId, params.lessonIds),
				buildWatchProgressDateRangeWhere(params),
			])
		)
		.groupBy(watchProgress.courseLessonId);

	return new Map(
		rows.map((row) => [
			row.courseLessonId,
			{
				learnersStarted: normalizeNumber(row.learnersStarted),
				learnersCompleted: normalizeNumber(row.learnersCompleted),
				avgProgressPercent: roundRate(normalizeNumber(row.avgProgressPercent)),
			},
		])
	);
}

export async function getAnalyticsOverview(
	params: AnalyticsOverviewParams
): Promise<AnalyticsOverviewResult> {
	const { db, input } = params;
	const now = new Date();
	const scopedCourses = await listScopedCourses({
		db,
		courseId: input.courseId,
	});
	const courseIds = scopedCourses.map((row) => row.id);

	const lessonCounts = await getLessonCountsByCourse({ db, courseIds });
	const viewAggregates = await getCourseViewAggregates({
		db,
		courseIds,
		from: input.from,
		to: input.to,
	});
	const enrollmentAggregates = await getCourseEnrollmentAggregates({
		db,
		courseIds,
		from: input.from,
		to: input.to,
	});
	const progressAggregates = await getCourseProgressAggregates({
		db,
		courseIds,
		from: input.from,
		to: input.to,
	});
	const revenueAggregates = await getCourseRevenueAggregates({
		db,
		courseIds,
		from: input.from,
		to: input.to,
	});
	const reviewAggregates = await getCourseReviewAggregates({
		db,
		courseIds,
		from: input.from,
		to: input.to,
	});
	const metricsByCourse = buildCourseMetricsMap({
		courseIds,
		lessonCounts,
		viewAggregates,
		enrollmentAggregates,
		progressAggregates,
		revenueAggregates,
		reviewAggregates,
	});
	const [uniqueViewers, learnersStarted] = await Promise.all([
		getScopedUniqueViewers({
			db,
			courseId: input.courseId,
			from: input.from,
			to: input.to,
		}),
		getScopedLearnersStarted({
			db,
			courseId: input.courseId,
			from: input.from,
			to: input.to,
		}),
	]);

	let totalViews = 0;
	let totalWatchDuration = 0;
	let totalEnrollments = 0;
	let activeEnrollments = 0;
	let courseCompletions = 0;
	let grossRevenue = 0;
	let refundedRevenue = 0;
	let visibleReviewCount = 0;
	let ratingSum = 0;

	for (const courseId of courseIds) {
		const metrics = metricsByCourse.get(courseId) ?? getCourseMetricDefaults();
		totalViews += metrics.totalViews;
		totalWatchDuration += metrics.totalWatchDuration;
		totalEnrollments += metrics.totalEnrollments;
		activeEnrollments += metrics.activeEnrollments;
		courseCompletions += metrics.courseCompletions;
		grossRevenue += metrics.grossRevenue;
		refundedRevenue += metrics.refundedRevenue;
		visibleReviewCount += metrics.visibleReviewCount;
		ratingSum += metrics.ratingSum;
	}

	return {
		totalViews,
		totalWatchDuration,
		uniqueViewers,
		totalCourses: scopedCourses.length,
		publishedCourses: scopedCourses.filter((row) => row.isPublished).length,
		totalEnrollments,
		activeEnrollments,
		learnersStarted,
		courseCompletions,
		grossRevenue,
		refundedRevenue,
		netRevenue: grossRevenue - refundedRevenue,
		visibleReviewCount,
		averageRating: toAverageRating({ visibleReviewCount, ratingSum }),
		generatedAt: now,
	};
}

export async function listLessonViewsAnalytics(
	params: AnalyticsLessonViewsParams
): Promise<AnalyticsLessonViewsResult> {
	const { db, input } = params;
	const page = input.page ?? 1;
	const limit = input.limit ?? 20;
	const lessonRows = await db
		.select({
			courseLessonId: courseLesson.id,
			courseId: courseLesson.courseId,
			courseTitle: course.title,
			title: courseLesson.title,
			lessonOrder: courseLesson.lessonOrder,
		})
		.from(courseLesson)
		.innerJoin(course, eq(courseLesson.courseId, course.id))
		.where(
			buildWhere([
				buildCourseScopeWhere({
					courseId: input.courseId,
				}),
				input.search
					? ilike(courseLesson.title, `%${input.search.trim()}%`)
					: undefined,
			])
		)
		.orderBy(
			asc(course.title),
			asc(courseLesson.lessonOrder),
			asc(courseLesson.id)
		);

	const lessonIds = lessonRows.map((row) => row.courseLessonId);
	const aggregates = await getLessonViewAggregates({
		db,
		lessonIds,
		from: input.from,
		to: input.to,
	});

	const items = lessonRows.map((row) => {
		const aggregate = aggregates.get(row.courseLessonId);
		return {
			courseLessonId: row.courseLessonId,
			courseId: row.courseId,
			courseTitle: row.courseTitle,
			title: row.title,
			aggregatedViews: aggregate?.totalViews ?? 0,
			aggregatedWatchDuration: aggregate?.aggregatedWatchDuration ?? 0,
			lessonOrder: row.lessonOrder,
		};
	});

	const paginatedItems = paginateItems(items, page, limit).map(
		({ lessonOrder: _lessonOrder, ...item }) => item
	);

	return {
		items: paginatedItems,
		pagination: toPagination({ page, limit, total: items.length }),
	};
}

export async function listCoursePerformanceAnalytics(
	params: AnalyticsCoursePerformanceParams
): Promise<AnalyticsCoursePerformanceResult> {
	const { db, input } = params;
	const page = input.page ?? 1;
	const limit = input.limit ?? 20;
	const scopedCourses = await listScopedCourses({
		db,
		courseId: input.courseId,
		search: input.search,
	});
	const courseIds = scopedCourses.map((row) => row.id);

	const lessonCounts = await getLessonCountsByCourse({ db, courseIds });
	const viewAggregates = await getCourseViewAggregates({
		db,
		courseIds,
		from: input.from,
		to: input.to,
	});
	const enrollmentAggregates = await getCourseEnrollmentAggregates({
		db,
		courseIds,
		from: input.from,
		to: input.to,
	});
	const progressAggregates = await getCourseProgressAggregates({
		db,
		courseIds,
		from: input.from,
		to: input.to,
	});
	const revenueAggregates = await getCourseRevenueAggregates({
		db,
		courseIds,
		from: input.from,
		to: input.to,
	});
	const reviewAggregates = await getCourseReviewAggregates({
		db,
		courseIds,
		from: input.from,
		to: input.to,
	});
	const metricsByCourse = buildCourseMetricsMap({
		courseIds,
		lessonCounts,
		viewAggregates,
		enrollmentAggregates,
		progressAggregates,
		revenueAggregates,
		reviewAggregates,
	});

	const items: AnalyticsCoursePerformanceItem[] = scopedCourses.map((row) => {
		const metrics = metricsByCourse.get(row.id) ?? getCourseMetricDefaults();
		const activationRate =
			metrics.activeEnrollments === 0
				? 0
				: roundRate(metrics.learnersStarted / metrics.activeEnrollments);
		const completionRate =
			metrics.learnersStarted === 0
				? 0
				: roundRate(metrics.courseCompletions / metrics.learnersStarted);

		return {
			courseId: row.id,
			courseTitle: row.title,
			isPublished: row.isPublished,
			isAvailable: row.isAvailable,
			publishedAt: row.publishedAt,
			lessonCount: metrics.lessonCount,
			totalEnrollments: metrics.totalEnrollments,
			activeEnrollments: metrics.activeEnrollments,
			learnersStarted: metrics.learnersStarted,
			activationRate,
			courseCompletions: metrics.courseCompletions,
			completionRate,
			totalViews: metrics.totalViews,
			totalWatchDuration: metrics.totalWatchDuration,
			averageWatchDurationPerViewer:
				metrics.uniqueViewers === 0
					? 0
					: Math.floor(metrics.totalWatchDuration / metrics.uniqueViewers),
			grossRevenue: metrics.grossRevenue,
			refundedRevenue: metrics.refundedRevenue,
			netRevenue: metrics.netRevenue,
			visibleReviewCount: metrics.visibleReviewCount,
			averageRating: toAverageRating({
				visibleReviewCount: metrics.visibleReviewCount,
				ratingSum: metrics.ratingSum,
			}),
		};
	});

	const sortBy = input.sortBy ?? "netRevenue";
	const direction = input.sortDirection ?? "desc";
	items.sort((left, right) => {
		const result = compareValues(left[sortBy], right[sortBy], direction);
		if (result !== 0) {
			return result;
		}
		return left.courseTitle.localeCompare(right.courseTitle);
	});

	return {
		items: paginateItems(items, page, limit),
		pagination: toPagination({ page, limit, total: items.length }),
	};
}

export async function listCourseLessonEngagementAnalytics(
	params: AnalyticsCourseLessonEngagementParams
): Promise<AnalyticsCourseLessonEngagementResult> {
	const { db, input } = params;
	const page = input.page ?? 1;
	const limit = input.limit ?? 20;
	const lessonRows: LessonDimensionRow[] = await db
		.select({
			id: courseLesson.id,
			courseId: courseLesson.courseId,
			courseTitle: course.title,
			lessonOrder: courseLesson.lessonOrder,
			title: courseLesson.title,
			duration: courseLesson.duration,
		})
		.from(courseLesson)
		.innerJoin(course, eq(courseLesson.courseId, course.id))
		.where(
			buildWhere([
				buildCourseScopeWhere({ courseId: input.courseId }),
				input.search
					? ilike(courseLesson.title, `%${input.search.trim()}%`)
					: undefined,
			])
		)
		.orderBy(asc(courseLesson.lessonOrder), asc(courseLesson.id));

	const lessonIds = lessonRows.map((row) => row.id);
	const viewAggregates = await getLessonViewAggregates({
		db,
		lessonIds,
		from: input.from,
		to: input.to,
	});
	const progressAggregates = await getLessonProgressAggregates({
		db,
		lessonIds,
		from: input.from,
		to: input.to,
	});

	const items: AnalyticsCourseLessonEngagementItem[] = lessonRows.map((row) => {
		const viewAggregate = viewAggregates.get(row.id);
		const progressAggregate = progressAggregates.get(row.id);
		const learnersStarted = progressAggregate?.learnersStarted ?? 0;
		const learnersCompleted = progressAggregate?.learnersCompleted ?? 0;
		const avgProgressPercent = progressAggregate?.avgProgressPercent ?? 0;
		return {
			courseLessonId: row.id,
			courseId: row.courseId,
			courseTitle: row.courseTitle,
			lessonOrder: row.lessonOrder,
			title: row.title,
			duration: row.duration,
			totalViews: viewAggregate?.totalViews ?? 0,
			uniqueViewers: viewAggregate?.uniqueViewers ?? 0,
			learnersStarted,
			learnersCompleted,
			completionRate:
				learnersStarted === 0
					? 0
					: roundRate(learnersCompleted / learnersStarted),
			avgProgressPercent,
			dropOffRate: roundRate(100 - avgProgressPercent),
			aggregatedWatchDuration: viewAggregate?.aggregatedWatchDuration ?? 0,
		};
	});

	const sortBy = input.sortBy ?? "lessonOrder";
	const direction = input.sortDirection ?? "asc";
	items.sort((left, right) => {
		const result = compareValues(left[sortBy], right[sortBy], direction);
		if (result !== 0) {
			return result;
		}
		return left.lessonOrder - right.lessonOrder;
	});

	return {
		items: paginateItems(items, page, limit),
		pagination: toPagination({ page, limit, total: items.length }),
	};
}

export async function listViewSessionsAnalytics(
	params: AnalyticsViewSessionsParams
): Promise<AnalyticsViewSessionsResult> {
	const { db, input } = params;
	const page = input.page ?? 1;
	const limit = input.limit ?? 20;
	const where = buildWhere([
		eq(course.isDeleted, false),
		input.userId ? eq(courseLessonView.userId, input.userId) : undefined,
		input.courseLessonId
			? eq(courseLessonView.courseLessonId, input.courseLessonId)
			: undefined,
		input.courseId ? eq(course.id, input.courseId) : undefined,
		input.from ? gte(courseLessonView.viewedAt, input.from) : undefined,
		input.to ? lte(courseLessonView.viewedAt, input.to) : undefined,
	]);

	const [countRow] = await db
		.select({ total: count() })
		.from(courseLessonView)
		.innerJoin(
			courseLesson,
			eq(courseLessonView.courseLessonId, courseLesson.id)
		)
		.innerJoin(course, eq(courseLesson.courseId, course.id))
		.where(where);
	const total = normalizeNumber(countRow?.total);

	const items = await db
		.select({
			id: courseLessonView.id,
			courseLessonId: courseLessonView.courseLessonId,
			userId: courseLessonView.userId,
			viewedAt: courseLessonView.viewedAt,
			watchDuration: courseLessonView.watchDuration,
			deviceType: courseLessonView.deviceType,
		})
		.from(courseLessonView)
		.innerJoin(
			courseLesson,
			eq(courseLessonView.courseLessonId, courseLesson.id)
		)
		.innerJoin(course, eq(courseLesson.courseId, course.id))
		.where(where)
		.orderBy(desc(courseLessonView.viewedAt), desc(courseLessonView.id))
		.limit(limit)
		.offset((page - 1) * limit);

	return {
		items: items.map((item) => ({
			...item,
			watchDuration:
				item.watchDuration === null
					? null
					: normalizeNumber(item.watchDuration),
		})),
		pagination: toPagination({ page, limit, total }),
	};
}
