import type {
	contentClassificationOutputSchema,
	contentDetailOutputSchema,
	contentListOutputSchema,
	contentSchema,
} from "server/modules/content/content.validators";
import type { z } from "zod";

export type Content = z.infer<typeof contentSchema>;
export type ContentDetail = z.infer<typeof contentDetailOutputSchema>;
export type ContentListOutput = z.infer<typeof contentListOutputSchema>;
export type ContentClassification = z.infer<
	typeof contentClassificationOutputSchema
>;
export type ContentType = "MOVIE" | "SERIES" | "EPISODE" | "MUSIC";
