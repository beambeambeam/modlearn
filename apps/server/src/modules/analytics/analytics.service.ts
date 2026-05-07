import type { SQL } from "drizzle-orm";
import { and, count, desc, eq, gte, ilike, inArray, lte } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { course, courseLesson, courseLessonView } from "@/lib/db/schema";
import type {
	AnalyticsLessonViewsParams,
	AnalyticsLessonViewsResult,
	AnalyticsOverviewParams,
	AnalyticsOverviewResult,
	AnalyticsViewSessionsParams,
	AnalyticsViewSessionsResult,
} from "./analytics.types";

function toPagination(params: { page: number; limit: number; total: number }) {
	const { page, limit, total } = params;
	return {
		page,
		limit,
		total,
		totalPages: total === 0 ? 0 : Math.ceil(total / limit),
	};
}

function buildViewDateRangeWhere(params: {
	from?: Date;
	to?: Date;
}): SQL<unknown> | undefined {
	const { from, to } = params;
	const conditions: SQL<unknown>[] = [];

	if (from) {
		conditions.push(gte(courseLessonView.viewedAt, from));
	}
	if (to) {
		conditions.push(lte(courseLessonView.viewedAt, to));
	}

	if (conditions.length === 0) {
		return undefined;
	}

	return and(...conditions);
}

export async function getAnalyticsOverview(
	params: AnalyticsOverviewParams
): Promise<AnalyticsOverviewResult> {
	const { db, input } = params;
	const now = new Date();
	const viewDateWhere = buildViewDateRangeWhere({
		from: input.from,
		to: input.to,
	});

	const [totalsRow] = await db
		.select({
			totalViews: count(courseLessonView.id),
			totalWatchDuration: sql<number>`coalesce(sum(${courseLessonView.watchDuration}), 0)::int`,
		})
		.from(courseLessonView)
		.where(viewDateWhere);

	return {
		totalViews: Number(totalsRow?.totalViews ?? 0),
		totalWatchDuration: Number(totalsRow?.totalWatchDuration ?? 0),
		generatedAt: now,
	};
}

export async function listLessonViewsAnalytics(
	params: AnalyticsLessonViewsParams
): Promise<AnalyticsLessonViewsResult> {
	const { db, input } = params;
	const page = input.page ?? 1;
	const limit = input.limit ?? 20;
	const offset = (page - 1) * limit;
	const lessonWhereConditions: SQL<unknown>[] = [eq(course.isDeleted, false)];

	const search = input.search?.trim();
	if (search) {
		lessonWhereConditions.push(ilike(courseLesson.title, `%${search}%`));
	}

	const lessonWhere = and(...lessonWhereConditions);

	const [countRow] = await db
		.select({ total: count() })
		.from(courseLesson)
		.innerJoin(course, eq(courseLesson.courseId, course.id))
		.where(lessonWhere);
	const total = Number(countRow?.total ?? 0);

	const lessonRows = await db
		.select({
			courseLessonId: courseLesson.id,
			courseId: courseLesson.courseId,
			courseTitle: course.title,
			title: courseLesson.title,
			createdAt: courseLesson.createdAt,
		})
		.from(courseLesson)
		.innerJoin(course, eq(courseLesson.courseId, course.id))
		.where(lessonWhere)
		.orderBy(
			desc(courseLesson.createdAt),
			desc(courseLesson.lessonOrder),
			desc(courseLesson.id)
		)
		.limit(limit)
		.offset(offset);

	if (lessonRows.length === 0) {
		return {
			items: [],
			pagination: toPagination({ page, limit, total }),
		};
	}

	const lessonIds = lessonRows.map((row) => row.courseLessonId);
	const viewConditions: SQL<unknown>[] = [
		inArray(courseLessonView.courseLessonId, lessonIds),
	];
	const viewDateWhere = buildViewDateRangeWhere({
		from: input.from,
		to: input.to,
	});
	if (viewDateWhere) {
		viewConditions.push(viewDateWhere);
	}

	const aggregateRows = await db
		.select({
			courseLessonId: courseLessonView.courseLessonId,
			aggregatedViews: count(courseLessonView.id),
			aggregatedWatchDuration: sql<number>`coalesce(sum(${courseLessonView.watchDuration}), 0)::int`,
		})
		.from(courseLessonView)
		.where(and(...viewConditions))
		.groupBy(courseLessonView.courseLessonId);

	const aggregatesByLessonId = new Map(
		aggregateRows.map((row) => [row.courseLessonId, row])
	);

	return {
		items: lessonRows.map((row) => {
			const aggregate = aggregatesByLessonId.get(row.courseLessonId);
			return {
				courseLessonId: row.courseLessonId,
				courseId: row.courseId,
				courseTitle: row.courseTitle,
				title: row.title,
				aggregatedViews: Number(aggregate?.aggregatedViews ?? 0),
				aggregatedWatchDuration: Number(
					aggregate?.aggregatedWatchDuration ?? 0
				),
			};
		}),
		pagination: toPagination({ page, limit, total }),
	};
}

export async function listViewSessionsAnalytics(
	params: AnalyticsViewSessionsParams
): Promise<AnalyticsViewSessionsResult> {
	const { db, input } = params;
	const page = input.page ?? 1;
	const limit = input.limit ?? 20;
	const offset = (page - 1) * limit;
	const whereConditions: SQL<unknown>[] = [];

	if (input.userId) {
		whereConditions.push(eq(courseLessonView.userId, input.userId));
	}
	if (input.courseLessonId) {
		whereConditions.push(
			eq(courseLessonView.courseLessonId, input.courseLessonId)
		);
	}
	if (input.from) {
		whereConditions.push(gte(courseLessonView.viewedAt, input.from));
	}
	if (input.to) {
		whereConditions.push(lte(courseLessonView.viewedAt, input.to));
	}

	const where =
		whereConditions.length > 0 ? and(...whereConditions) : undefined;
	const [countRow] = await db
		.select({ total: count() })
		.from(courseLessonView)
		.where(where);
	const total = Number(countRow?.total ?? 0);

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
		.where(where)
		.orderBy(desc(courseLessonView.viewedAt), desc(courseLessonView.id))
		.limit(limit)
		.offset(offset);

	return {
		items: items.map((item) => ({
			...item,
			watchDuration:
				item.watchDuration === null ? null : Number(item.watchDuration),
		})),
		pagination: toPagination({ page, limit, total }),
	};
}
