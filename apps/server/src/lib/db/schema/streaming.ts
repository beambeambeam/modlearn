import { relations } from "drizzle-orm";
import {
	bigint,
	boolean,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { session, user } from "./auth";
import { content } from "./content";
import { playlist } from "./playlist";

export const playbackSessionStatusEnum = pgEnum("playback_session_status", [
	"ACTIVE",
	"PAUSED",
	"STOPPED",
	"ENDED",
	"EXPIRED",
]);

export const playbackEventTypeEnum = pgEnum("playback_event_type", [
	"PLAY",
	"PAUSE",
	"RESUME",
	"SEEK",
	"STOP",
]);

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

export const playbackSession = pgTable(
	"playback_session",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		contentId: uuid("content_id")
			.notNull()
			.references(() => content.id, { onDelete: "cascade" }),
		playlistId: uuid("playlist_id").references(() => playlist.id, {
			onDelete: "set null",
		}),
		playbackToken: text("playback_token").notNull().unique(),
		status: playbackSessionStatusEnum("status").default("ACTIVE").notNull(),
		startedAt: timestamp("started_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		lastEventAt: timestamp("last_event_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		endedAt: timestamp("ended_at", { withTimezone: true }),
		lastPosition: bigint("last_position", { mode: "number" })
			.default(0)
			.notNull(),
		duration: bigint("duration", { mode: "number" }).default(0).notNull(),
		deviceType: text("device_type"),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("playbackSession_userStatus_idx").on(table.userId, table.status),
		index("playbackSession_contentId_idx").on(table.contentId),
		index("playbackSession_token_idx").on(table.playbackToken),
		index("playbackSession_expiresAt_idx").on(table.expiresAt),
	]
);

export const playbackEvent = pgTable(
	"playback_event",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		sessionId: uuid("session_id")
			.notNull()
			.references(() => playbackSession.id, { onDelete: "cascade" }),
		eventType: playbackEventTypeEnum("event_type").notNull(),
		position: bigint("position", { mode: "number" }).default(0).notNull(),
		duration: bigint("duration", { mode: "number" }).default(0).notNull(),
		deviceType: text("device_type"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("playbackEvent_sessionCreatedAt_idx").on(
			table.sessionId,
			table.createdAt
		),
		index("playbackEvent_typeCreatedAt_idx").on(
			table.eventType,
			table.createdAt
		),
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

export const playbackSessionRelations = relations(
	playbackSession,
	({ one, many }) => ({
		user: one(user, {
			fields: [playbackSession.userId],
			references: [user.id],
		}),
		content: one(content, {
			fields: [playbackSession.contentId],
			references: [content.id],
		}),
		playlist: one(playlist, {
			fields: [playbackSession.playlistId],
			references: [playlist.id],
		}),
		events: many(playbackEvent),
	})
);

export const playbackEventRelations = relations(playbackEvent, ({ one }) => ({
	session: one(playbackSession, {
		fields: [playbackEvent.sessionId],
		references: [playbackSession.id],
	}),
}));
