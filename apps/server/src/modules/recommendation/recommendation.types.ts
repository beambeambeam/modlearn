import type { DbClient } from "@/lib/db/orm";
import type { content } from "@/lib/db/schema";

export interface RecommendationListForMeInput {
	limit?: number;
}

export interface RecommendationListPopularInput {
	limit?: number;
}

export interface RecommendationListRecentlyAddedInput {
	limit?: number;
}

export interface ListRecommendationsForUserInput {
	userId: string;
	limit?: number;
}

export interface ListRecommendationsForUserParams {
	db: DbClient;
	input: ListRecommendationsForUserInput;
}

export interface ListPopularRecommendationsParams {
	db: DbClient;
	input: RecommendationListPopularInput;
}

export interface ListRecentlyAddedRecommendationsParams {
	db: DbClient;
	input: RecommendationListRecentlyAddedInput;
}

export type RecommendationItem = typeof content.$inferSelect;
