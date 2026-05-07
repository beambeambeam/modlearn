import { relations } from "drizzle-orm";
import {
	bigint,
	boolean,
	index,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

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

export const file = pgTable(
	"file",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		uploaderId: text("uploader_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		uploadedAt: timestamp("uploaded_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		name: text("name").notNull(),
		size: bigint("size", { mode: "number" }).notNull(),
		mimeType: text("mime_type").notNull(),
		extension: text("extension").notNull(),
		checksum: text("checksum").notNull(),
		isDeleted: boolean("is_deleted").default(false).notNull(),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(table) => [
		index("file_uploaderId_idx").on(table.uploaderId),
		index("file_checksum_idx").on(table.checksum),
		index("file_deleted_idx").on(table.isDeleted),
	]
);

export const categoryRelations = relations(category, () => ({
	// Category remains available for the next schema phase.
}));

export const fileRelations = relations(file, ({ one }) => ({
	uploader: one(user, {
		fields: [file.uploaderId],
		references: [user.id],
	}),
}));
