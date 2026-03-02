import { relations } from "drizzle-orm";
import {
	bigint,
	boolean,
	index,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { session, user } from "./auth";
import { content } from "./content";
import { playlist } from "./playlist";

export const watchProgress = pgTable(
	"watch_progress",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		contentId: uuid("content_id")
			.notNull()
			.references(() => content.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		playlistId: uuid("playlist_id").references(() => playlist.id, {
			onDelete: "set null",
		}),
		lastPosition: bigint("last_position", { mode: "number" }).notNull(),
		duration: bigint("duration", { mode: "number" }).notNull(),
		isCompleted: boolean("is_completed").default(false).notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
		deviceType: text("device_type"),
	},
	(table) => [
		index("watchProgress_userId_idx").on(table.userId),
		index("watchProgress_contentId_idx").on(table.contentId),
		unique("watchProgress_userContent_unique").on(
			table.userId,
			table.contentId
		),
		index("watchProgress_completed_idx").on(table.userId, table.isCompleted),
	]
);

export const contentView = pgTable(
	"content_view",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		contentId: uuid("content_id")
			.notNull()
			.references(() => content.id, { onDelete: "cascade" }),
		userId: text("user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		sessionId: text("session_id").references(() => session.id, {
			onDelete: "set null",
		}),
		viewedAt: timestamp("viewed_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		watchDuration: bigint("watch_duration", { mode: "number" }).default(0),
		deviceType: text("device_type"),
	},
	(table) => [
		index("contentView_contentId_idx").on(table.contentId),
		index("contentView_userId_idx").on(table.userId),
		index("contentView_viewedAt_idx").on(table.viewedAt),
		index("contentView_sessionId_idx").on(table.sessionId),
	]
);

export const watchProgressRelations = relations(watchProgress, ({ one }) => ({
	content: one(content, {
		fields: [watchProgress.contentId],
		references: [content.id],
	}),
	user: one(user, {
		fields: [watchProgress.userId],
		references: [user.id],
	}),
	playlist: one(playlist, {
		fields: [watchProgress.playlistId],
		references: [playlist.id],
	}),
}));

export const contentViewRelations = relations(contentView, ({ one }) => ({
	content: one(content, {
		fields: [contentView.contentId],
		references: [content.id],
	}),
	user: one(user, {
		fields: [contentView.userId],
		references: [user.id],
	}),
	session: one(session, {
		fields: [contentView.sessionId],
		references: [session.id],
	}),
}));
