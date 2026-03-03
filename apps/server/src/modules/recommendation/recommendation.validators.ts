import { z } from "zod";
import { contentSchema } from "@/modules/content/content.validators";

export const recommendationListForMeInputSchema = z.object({
	limit: z.number().int().min(1).max(50).default(20),
});

export const recommendationListForMeOutputSchema = z.array(contentSchema);

export const recommendationListPopularInputSchema = z.object({
	limit: z.number().int().min(1).max(50).default(10),
});

export const recommendationListPopularOutputSchema = z.array(contentSchema);

export const recommendationListRecentlyAddedInputSchema = z.object({
	limit: z.number().int().min(1).max(50).default(10),
});

export const recommendationListRecentlyAddedOutputSchema =
	z.array(contentSchema);
