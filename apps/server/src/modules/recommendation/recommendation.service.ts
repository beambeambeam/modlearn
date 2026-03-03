import { and, count, desc, eq, inArray, notInArray, sql } from "drizzle-orm";

import type { DbClient } from "@/lib/db/orm";
import { content, contentCategory, watchProgress } from "@/lib/db/schema";
import { listPopularContent } from "@/modules/content/content.service";
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
	excludedContentIds?: string[];
}): Promise<RecommendationItem[]> {
	const { db, limit, excludedContentIds = [] } = params;
	const popularItems = await listPopularContent({
		db,
		input: {
			limit: limit + excludedContentIds.length,
		},
	});

	if (excludedContentIds.length === 0) {
		return popularItems.slice(0, limit);
	}

	const excluded = new Set(excludedContentIds);
	return popularItems.filter((item) => !excluded.has(item.id)).slice(0, limit);
}

export function listPopularRecommendations(
	params: ListPopularRecommendationsParams
): Promise<RecommendationItem[]> {
	const { db, input } = params;
	return listPopularContent({
		db,
		input: {
			limit: input.limit ?? 10,
		},
	});
}

export function listRecentlyAddedRecommendations(
	params: ListRecentlyAddedRecommendationsParams
): Promise<RecommendationItem[]> {
	const { db, input } = params;
	const limit = input.limit ?? 10;

	return db
		.select()
		.from(content)
		.where(
			and(
				eq(content.isDeleted, false),
				eq(content.isPublished, true),
				eq(content.isAvailable, true)
			)
		)
		.orderBy(desc(content.createdAt), desc(content.id))
		.limit(limit);
}

export async function listRecommendationsForUser(
	params: ListRecommendationsForUserParams
): Promise<RecommendationItem[]> {
	const { db, input } = params;
	const limit = input.limit ?? 20;

	const watchHistoryRows = await db
		.select({
			contentId: watchProgress.contentId,
		})
		.from(watchProgress)
		.where(eq(watchProgress.userId, input.userId))
		.orderBy(desc(watchProgress.updatedAt), desc(watchProgress.id))
		.limit(MAX_HISTORY_ITEMS);

	const watchedContentIds = watchHistoryRows.map((row) => row.contentId);
	if (watchedContentIds.length === 0) {
		return listPopularFallback({
			db,
			limit,
		});
	}

	const affinityRows = await db
		.select({
			categoryId: contentCategory.categoryId,
			weight: count().as("weight"),
		})
		.from(contentCategory)
		.where(inArray(contentCategory.contentId, watchedContentIds))
		.groupBy(contentCategory.categoryId);

	if (affinityRows.length === 0) {
		return listPopularFallback({
			db,
			limit,
			excludedContentIds: watchedContentIds,
		});
	}

	const affinityByCategory = db
		.select({
			categoryId: contentCategory.categoryId,
			weight: count().as("weight"),
		})
		.from(contentCategory)
		.where(inArray(contentCategory.contentId, watchedContentIds))
		.groupBy(contentCategory.categoryId)
		.as("affinity_by_category");

	const affinityScoreExpression = sql<number>`COALESCE(SUM(${affinityByCategory.weight}), 0)::int`;
	const popularityScoreExpression = sql<number>`LN(1 + (${content.viewCount})::double precision)`;
	const finalScoreExpression = sql<number>`(${affinityScoreExpression} * ${AFFINITY_WEIGHT_MULTIPLIER} + ${popularityScoreExpression})`;

	const candidateRows = await db
		.select({
			item: content,
			affinityScore: affinityScoreExpression,
		})
		.from(content)
		.leftJoin(contentCategory, eq(contentCategory.contentId, content.id))
		.leftJoin(
			affinityByCategory,
			eq(affinityByCategory.categoryId, contentCategory.categoryId)
		)
		.where(
			and(
				eq(content.isDeleted, false),
				eq(content.isPublished, true),
				eq(content.isAvailable, true),
				notInArray(content.id, watchedContentIds)
			)
		)
		.groupBy(content.id)
		.orderBy(
			desc(finalScoreExpression),
			desc(content.viewCount),
			desc(content.createdAt),
			desc(content.id)
		)
		.limit(limit);

	const hasAffinityMatch = candidateRows.some(
		(row) => Number(row.affinityScore) > 0
	);

	if (!hasAffinityMatch) {
		return listPopularFallback({
			db,
			limit,
			excludedContentIds: watchedContentIds,
		});
	}

	return candidateRows.map((row) => row.item);
}
