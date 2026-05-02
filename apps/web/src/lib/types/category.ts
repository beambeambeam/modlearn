import type { z } from "zod";
import type {
  categorySchema,
  categoryListOutputSchema,
} from "server/modules/category/category.validators";

export type Category           = z.infer<typeof categorySchema>;
export type CategoryListOutput = z.infer<typeof categoryListOutputSchema>;