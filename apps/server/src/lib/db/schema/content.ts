import { relations } from "drizzle-orm";
import {
	bigint,
	boolean,
	date,
	decimal,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { timestamps } from "./_helpers";
import { user } from "./auth";

export const contentTypeEnum = pgEnum("content_type", [
	"MOVIE",
	"SERIES",
	"EPISODE",
	"MUSIC",
]);

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

export const genre = pgTable(
	"genre",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		title: text("title").notNull(),
		description: text("description"),
		slug: text("slug").unique(),
	},
	(table) => [index("genre_slug_idx").on(table.slug)]
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

export const content = pgTable(
	"content",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		title: text("title").notNull(),
		description: text("description"),
		thumbnailImageId: uuid("thumbnail_image_id").references(() => file.id, {
			onDelete: "set null",
		}),
		duration: bigint("duration", { mode: "number" }),
		isAvailable: boolean("is_available").default(true).notNull(),
		isPublished: boolean("is_published").default(false).notNull(),
		publishedAt: timestamp("published_at", { withTimezone: true }),
		...timestamps,
		updatedBy: text("updated_by")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		releaseDate: date("release_date", { mode: "date" }),
		contentType: contentTypeEnum("content_type").notNull(),
		viewCount: bigint("view_count", { mode: "number" }).default(0).notNull(),
		fileId: uuid("file_id").references(() => file.id, {
			onDelete: "set null",
		}),
	},
	(table) => [
		index("content_type_idx").on(table.contentType),
		index("content_published_idx").on(table.isPublished, table.publishedAt),
		index("content_updatedBy_idx").on(table.updatedBy),
		index("content_releaseDate_idx").on(table.releaseDate),
		index("content_viewCount_idx").on(table.viewCount),
	]
);

export const contentCategory = pgTable(
	"content_category",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		contentId: uuid("content_id")
			.notNull()
			.references(() => content.id, { onDelete: "cascade" }),
		categoryId: uuid("category_id")
			.notNull()
			.references(() => category.id, { onDelete: "cascade" }),
	},
	(table) => [
		index("contentCategory_contentId_idx").on(table.contentId),
		index("contentCategory_categoryId_idx").on(table.categoryId),
		unique("contentCategory_unique").on(table.contentId, table.categoryId),
	]
);

export const contentGenre = pgTable(
	"content_genre",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		contentId: uuid("content_id")
			.notNull()
			.references(() => content.id, { onDelete: "cascade" }),
		genreId: uuid("genre_id")
			.notNull()
			.references(() => genre.id, { onDelete: "cascade" }),
	},
	(table) => [
		index("contentGenre_contentId_idx").on(table.contentId),
		index("contentGenre_genreId_idx").on(table.genreId),
		unique("contentGenre_unique").on(table.contentId, table.genreId),
	]
);

export const contentPricing = pgTable(
	"content_pricing",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		contentId: uuid("content_id")
			.notNull()
			.references(() => content.id, { onDelete: "cascade" }),
		price: decimal("price", { precision: 10, scale: 2 }).notNull(),
		currency: text("currency").notNull(),
		effectiveFrom: timestamp("effective_from", {
			withTimezone: true,
		}).notNull(),
		effectiveTo: timestamp("effective_to", { withTimezone: true }),
		createdBy: text("created_by")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("contentPricing_contentId_idx").on(table.contentId),
		index("contentPricing_effective_idx").on(
			table.effectiveFrom,
			table.effectiveTo
		),
	]
);

export const categoryRelations = relations(category, ({ many }) => ({
	contentCategories: many(contentCategory),
}));

export const genreRelations = relations(genre, ({ many }) => ({
	contentGenres: many(contentGenre),
}));

export const fileRelations = relations(file, ({ one, many }) => ({
	uploader: one(user, {
		fields: [file.uploaderId],
		references: [user.id],
	}),
	contentsAsThumbnail: many(content, { relationName: "thumbnailImage" }),
	contentsAsFile: many(content, { relationName: "contentFile" }),
}));

export const contentRelations = relations(content, ({ one, many }) => ({
	thumbnailImage: one(file, {
		fields: [content.thumbnailImageId],
		references: [file.id],
		relationName: "thumbnailImage",
	}),
	contentFile: one(file, {
		fields: [content.fileId],
		references: [file.id],
		relationName: "contentFile",
	}),
	updatedByUser: one(user, {
		fields: [content.updatedBy],
		references: [user.id],
	}),
	contentCategories: many(contentCategory),
	contentGenres: many(contentGenre),
	contentPricings: many(contentPricing),
}));

export const contentCategoryRelations = relations(
	contentCategory,
	({ one }) => ({
		content: one(content, {
			fields: [contentCategory.contentId],
			references: [content.id],
		}),
		category: one(category, {
			fields: [contentCategory.categoryId],
			references: [category.id],
		}),
	})
);

export const contentGenreRelations = relations(contentGenre, ({ one }) => ({
	content: one(content, {
		fields: [contentGenre.contentId],
		references: [content.id],
	}),
	genre: one(genre, {
		fields: [contentGenre.genreId],
		references: [genre.id],
	}),
}));

export const contentPricingRelations = relations(contentPricing, ({ one }) => ({
	content: one(content, {
		fields: [contentPricing.contentId],
		references: [content.id],
	}),
	createdByUser: one(user, {
		fields: [contentPricing.createdBy],
		references: [user.id],
	}),
}));
