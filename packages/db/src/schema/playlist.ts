import { relations } from "drizzle-orm";
import {
	boolean,
	decimal,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { content, file } from "./content";

export const playlist = pgTable(
	"playlist",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		creatorId: text("creator_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		description: text("description"),
		thumbnailImageId: uuid("thumbnail_image_id").references(() => file.id, {
			onDelete: "set null",
		}),
		isCourse: boolean("is_course").default(true).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("playlist_creatorId_idx").on(table.creatorId),
		index("playlist_course_idx").on(table.isCourse),
	]
);

export const playlistItem = pgTable(
	"playlist_item",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		playlistId: uuid("playlist_id")
			.notNull()
			.references(() => playlist.id, { onDelete: "cascade" }),
		contentId: uuid("content_id")
			.notNull()
			.references(() => content.id, { onDelete: "cascade" }),
		itemOrder: integer("item_order").notNull(),
		sectionNumber: integer("section_number"),
		itemNumber: integer("item_number"),
		title: text("title"),
		addedAt: timestamp("added_at").defaultNow().notNull(),
	},
	(table) => [
		index("playlistItem_playlistId_idx").on(table.playlistId),
		index("playlistItem_contentId_idx").on(table.contentId),
		index("playlistItem_order_idx").on(
			table.playlistId,
			table.sectionNumber,
			table.itemOrder
		),
	]
);

export const playlistProgress = pgTable(
	"playlist_progress",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		playlistId: uuid("playlist_id")
			.notNull()
			.references(() => playlist.id, { onDelete: "cascade" }),
		contentId: uuid("content_id")
			.notNull()
			.references(() => content.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		isLatestWatched: boolean("is_latest_watched").default(false).notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("playlistProgress_playlistId_idx").on(table.playlistId),
		index("playlistProgress_userId_idx").on(table.userId),
		index("playlistProgress_latest_idx").on(
			table.userId,
			table.playlistId,
			table.isLatestWatched
		),
	]
);

export const playlistPricing = pgTable(
	"playlist_pricing",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		playlistId: uuid("playlist_id")
			.notNull()
			.references(() => playlist.id, { onDelete: "cascade" }),
		price: decimal("price", { precision: 10, scale: 2 }).notNull(),
		currency: text("currency").notNull(),
		effectiveFrom: timestamp("effective_from").notNull(),
		effectiveTo: timestamp("effective_to"),
		createdBy: text("created_by")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("playlistPricing_playlistId_idx").on(table.playlistId),
		index("playlistPricing_effective_idx").on(
			table.effectiveFrom,
			table.effectiveTo
		),
	]
);

export const playlistRelations = relations(playlist, ({ one, many }) => ({
	creator: one(user, {
		fields: [playlist.creatorId],
		references: [user.id],
	}),
	thumbnailImage: one(file, {
		fields: [playlist.thumbnailImageId],
		references: [file.id],
	}),
	playlistItems: many(playlistItem),
	playlistProgresses: many(playlistProgress),
	playlistPricings: many(playlistPricing),
}));

export const playlistItemRelations = relations(playlistItem, ({ one }) => ({
	playlist: one(playlist, {
		fields: [playlistItem.playlistId],
		references: [playlist.id],
	}),
	content: one(content, {
		fields: [playlistItem.contentId],
		references: [content.id],
	}),
}));

export const playlistProgressRelations = relations(
	playlistProgress,
	({ one }) => ({
		playlist: one(playlist, {
			fields: [playlistProgress.playlistId],
			references: [playlist.id],
		}),
		content: one(content, {
			fields: [playlistProgress.contentId],
			references: [content.id],
		}),
		user: one(user, {
			fields: [playlistProgress.userId],
			references: [user.id],
		}),
	})
);

export const playlistPricingRelations = relations(
	playlistPricing,
	({ one }) => ({
		playlist: one(playlist, {
			fields: [playlistPricing.playlistId],
			references: [playlist.id],
		}),
		createdByUser: one(user, {
			fields: [playlistPricing.createdBy],
			references: [user.id],
		}),
	})
);
