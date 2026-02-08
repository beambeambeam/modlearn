import { relations } from "drizzle-orm";
import {
	boolean,
	date,
	decimal,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { timestamps } from "./_helpers";
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
		isSeries: boolean("is_series").default(true).notNull(),
		...timestamps,
	},
	(table) => [
		index("playlist_creatorId_idx").on(table.creatorId),
		index("playlist_series_idx").on(table.isSeries),
	]
);

export const playlistEpisode = pgTable(
	"playlist_episode",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		playlistId: uuid("playlist_id")
			.notNull()
			.references(() => playlist.id, { onDelete: "cascade" }),
		contentId: uuid("content_id")
			.notNull()
			.references(() => content.id, { onDelete: "cascade" }),
		episodeOrder: integer("episode_order").notNull(),
		seasonNumber: integer("season_number"),
		episodeNumber: integer("episode_number"),
		title: text("title"),
		addedAt: timestamp("added_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("playlistEpisode_playlistId_idx").on(table.playlistId),
		index("playlistEpisode_contentId_idx").on(table.contentId),
		index("playlistEpisode_order_idx").on(
			table.playlistId,
			table.seasonNumber,
			table.episodeOrder
		),
	]
);

export const playlistContent = pgTable(
	"playlist_content",
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
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("playlistContent_playlistId_idx").on(table.playlistId),
		index("playlistContent_userId_idx").on(table.userId),
		index("playlistContent_latest_idx").on(
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
		effectiveFrom: date("effective_from", { mode: "date" }).notNull(),
		effectiveTo: date("effective_to", { mode: "date" }),
		createdBy: text("created_by")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
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
	playlistEpisodes: many(playlistEpisode),
	playlistContents: many(playlistContent),
	playlistPricings: many(playlistPricing),
}));

export const playlistEpisodeRelations = relations(
	playlistEpisode,
	({ one }) => ({
		playlist: one(playlist, {
			fields: [playlistEpisode.playlistId],
			references: [playlist.id],
		}),
		content: one(content, {
			fields: [playlistEpisode.contentId],
			references: [content.id],
		}),
	})
);

export const playlistContentRelations = relations(
	playlistContent,
	({ one }) => ({
		playlist: one(playlist, {
			fields: [playlistContent.playlistId],
			references: [playlist.id],
		}),
		content: one(content, {
			fields: [playlistContent.contentId],
			references: [content.id],
		}),
		user: one(user, {
			fields: [playlistContent.userId],
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
