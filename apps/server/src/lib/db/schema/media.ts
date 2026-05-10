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

export const fileRelations = relations(file, ({ one }) => ({
	uploader: one(user, {
		fields: [file.uploaderId],
		references: [user.id],
	}),
}));

export const storageRelations = relations(storage, ({ one }) => ({
	file: one(file, {
		fields: [storage.fileId],
		references: [file.id],
	}),
}));
