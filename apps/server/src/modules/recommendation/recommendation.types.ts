import type { DbClient } from "@/lib/db/orm";
import type { content } from "@/lib/db/schema";

export interface RecommendationListForMeInput {
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

export type RecommendationItem = typeof content.$inferSelect;
