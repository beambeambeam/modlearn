import type {
	categoryListOutputSchema,
	categorySchema,
} from "server/modules/category/category.validators";
import type { z } from "zod";

export type Category = z.infer<typeof categorySchema>;
export type CategoryListOutput = z.infer<typeof categoryListOutputSchema>;
