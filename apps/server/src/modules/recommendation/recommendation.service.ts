import { and, count, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import type { DbClient } from "@/lib/db/orm";
import {
	course,
	courseCategory,
	courseLesson,
	courseLessonView,
	watchProgress,
} from "@/lib/db/schema";
import type {
	ListPopularRecommendationsParams,
	ListRecentlyAddedRecommendationsParams,
	ListRecommendationsForUserParams,
	RecommendationItem,
} from "./recommendation.types";

const MAX_HISTORY_ITEMS = 100;
const AFFINITY_WEIGHT_MULTIPLIER = 1000;

async function listPopularFallback(params: {
	db: DbClient;
	limit: number;
	excludedLessonIds?: string[];
}): Promise<RecommendationItem[]> {
	const { db, limit, excludedLessonIds = [] } = params;
	const excluded = new Set(excludedLessonIds);

	const rows = await db
		.select({
			item: courseLesson,
			views: count(courseLessonView.id),
		})
		.from(courseLesson)
		.innerJoin(course, eq(courseLesson.courseId, course.id))
		.leftJoin(
			courseLessonView,
			eq(courseLessonView.courseLessonId, courseLesson.id)
		)
		.where(
			and(
				eq(course.isDeleted, false),
				eq(course.isPublished, true),
				eq(course.isAvailable, true)
			)
		)
		.groupBy(courseLesson.id, course.id)
		.orderBy(
			desc(count(courseLessonView.id)),
			desc(courseLesson.createdAt),
			desc(courseLesson.id)
		)
		.limit(limit + excludedLessonIds.length);

	return rows
		.map((row) => row.item)
		.filter((item) => !excluded.has(item.id))
		.slice(0, limit);
}

export function listPopularRecommendations(
	params: ListPopularRecommendationsParams
): Promise<RecommendationItem[]> {
	const { db, input } = params;
	return listPopularFallback({
		db,
		limit: input.limit ?? 10,
	});
}

export function listRecentlyAddedRecommendations(
	params: ListRecentlyAddedRecommendationsParams
): Promise<RecommendationItem[]> {
	const { db, input } = params;
	const limit = input.limit ?? 10;

	return db
		.select()
		.from(courseLesson)
		.innerJoin(course, eq(courseLesson.courseId, course.id))
		.where(
			and(
				eq(course.isDeleted, false),
				eq(course.isPublished, true),
				eq(course.isAvailable, true)
			)
		)
		.orderBy(desc(courseLesson.createdAt), desc(courseLesson.id))
		.limit(limit)
		.then((rows) => rows.map((row) => row.course_lesson ?? row));
}

export async function listRecommendationsForUser(
	params: ListRecommendationsForUserParams
): Promise<RecommendationItem[]> {
	const { db, input } = params;
	const limit = input.limit ?? 20;

	const watchHistoryRows = await db
		.select({
			courseId: watchProgress.courseId,
			courseLessonId: watchProgress.courseLessonId,
		})
		.from(watchProgress)
		.where(eq(watchProgress.userId, input.userId))
		.orderBy(desc(watchProgress.updatedAt), desc(watchProgress.id))
		.limit(MAX_HISTORY_ITEMS);

	const watchedLessonIds = watchHistoryRows.map((row) => row.courseLessonId);
	const watchedCourseIds = Array.from(
		new Set(watchHistoryRows.map((row) => row.courseId))
	);

	if (watchedLessonIds.length === 0) {
		return listPopularFallback({
			db,
			limit,
		});
	}

	const affinityRows = await db
		.select({
			categoryId: courseCategory.categoryId,
			weight: count().as("weight"),
		})
		.from(courseCategory)
		.where(inArray(courseCategory.courseId, watchedCourseIds))
		.groupBy(courseCategory.categoryId);

	if (affinityRows.length === 0) {
		return listPopularFallback({
			db,
			limit,
			excludedLessonIds: watchedLessonIds,
		});
	}

	const affinityByCategory = db
		.select({
			categoryId: courseCategory.categoryId,
			weight: count().as("weight"),
		})
		.from(courseCategory)
		.where(inArray(courseCategory.courseId, watchedCourseIds))
		.groupBy(courseCategory.categoryId)
		.as("affinity_by_category");

	const affinityScoreExpression = sql<number>`COALESCE(SUM(${affinityByCategory.weight}), 0)::int`;
	const popularityScoreExpression = sql<number>`LN(1 + COUNT(${courseLessonView.id})::double precision)`;
	const finalScoreExpression = sql<number>`(${affinityScoreExpression} * ${AFFINITY_WEIGHT_MULTIPLIER} + ${popularityScoreExpression})`;

	const candidateRows = await db
		.select({
			item: courseLesson,
			affinityScore: affinityScoreExpression,
		})
		.from(courseLesson)
		.innerJoin(course, eq(courseLesson.courseId, course.id))
		.leftJoin(courseCategory, eq(courseCategory.courseId, course.id))
		.leftJoin(
			affinityByCategory,
			eq(affinityByCategory.categoryId, courseCategory.categoryId)
		)
		.leftJoin(
			courseLessonView,
			eq(courseLessonView.courseLessonId, courseLesson.id)
		)
		.where(
			and(
				eq(course.isDeleted, false),
				eq(course.isPublished, true),
				eq(course.isAvailable, true),
				notInArray(courseLesson.id, watchedLessonIds)
			)
		)
		.groupBy(courseLesson.id, course.id)
		.orderBy(
			desc(finalScoreExpression),
			desc(count(courseLessonView.id)),
			desc(courseLesson.createdAt),
			desc(courseLesson.id)
		)
		.limit(limit);

	const hasAffinityMatch = candidateRows.some(
		(row) => Number(row.affinityScore) > 0
	);

	if (!hasAffinityMatch) {
		return listPopularFallback({
			db,
			limit,
			excludedLessonIds: watchedLessonIds,
		});
	}

	return candidateRows.map((row) => row.item);
}
