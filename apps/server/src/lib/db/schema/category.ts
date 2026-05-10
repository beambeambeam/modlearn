import { relations } from "drizzle-orm";
import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";

export const category = pgTable(
	"category",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		title: text("title").notNull(),
		description: text("description"),
		slug: text("slug").unique(),
	},
	(table) => [index("category_slug_idx").on(table.slug)]
);

export const categoryRelations = relations(category, () => ({}));
