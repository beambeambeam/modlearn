import { relations } from "drizzle-orm";
import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { file } from "./content";

export const storage = pgTable(
	"storage",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		fileId: uuid("file_id")
			.notNull()
			.references(() => file.id, { onDelete: "cascade" }),
		storageProvider: text("storage_provider").notNull(),
		bucket: text("bucket"),
		storageKey: text("storage_key").notNull(),
		cdnUrl: text("cdn_url"),
	},
	(table) => [
		index("storage_fileId_idx").on(table.fileId),
		index("storage_providerKey_idx").on(
			table.storageProvider,
			table.storageKey
		),
	]
);

export const storageRelations = relations(storage, ({ one }) => ({
	file: one(file, {
		fields: [storage.fileId],
		references: [file.id],
	}),
}));
