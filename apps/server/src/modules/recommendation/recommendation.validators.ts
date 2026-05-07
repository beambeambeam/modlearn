import { z } from "zod";
import { courseLessonSchema } from "@/modules/course/course.validators";

export const recommendationListForMeInputSchema = z.object({
	limit: z.number().int().min(1).max(50).default(20),
});

export const recommendationListForMeOutputSchema = z.array(courseLessonSchema);

export const recommendationListPopularInputSchema = z.object({
	limit: z.number().int().min(1).max(50).default(10),
});

export const recommendationListPopularOutputSchema = z.array(courseLessonSchema);

export const recommendationListRecentlyAddedInputSchema = z.object({
	limit: z.number().int().min(1).max(50).default(10),
});

export const recommendationListRecentlyAddedOutputSchema =
	z.array(courseLessonSchema);
