import { count, desc } from "drizzle-orm";
import type { DbClient } from "@/lib/db/orm";
import { and, eq } from "@/lib/db/orm";

import { content, playlist, watchProgress } from "@/lib/db/schema";
import type {
	ContinueWatchingItem,
	ContinueWatchingResult,
	GetWatchProgressResumeParams,
	ListContinueWatchingParams,
	MarkWatchProgressCompletedParams,
	ProgressEnvelope,
	SaveWatchProgressParams,
	WatchProgressResumeResult,
} from "./watch-progress.types";
import {
	WatchProgressContentNotFoundError,
	WatchProgressPlaylistNotFoundError,
	WatchProgressValidationError,
} from "./watch-progress.types";

const COMPLETION_THRESHOLD = 0.95;

function toProgressPercent(lastPosition: number, duration: number): number {
	if (duration <= 0) {
		return 0;
	}
	return Math.round((lastPosition / duration) * 100);
}

function toEnvelope(row: typeof watchProgress.$inferSelect): ProgressEnvelope {
	return {
		progress: row,
		progressPercent: toProgressPercent(row.lastPosition, row.duration),
	};
}

async function assertContentExists(
	db: DbClient,
	contentId: string
): Promise<void> {
	const row = await db.query.content.findFirst({
		where: and(eq(content.id, contentId), eq(content.isDeleted, false)),
		columns: { id: true },
	});

	if (!row) {
		throw new WatchProgressContentNotFoundError();
	}
}

async function assertPlaylistExists(
	db: DbClient,
	playlistId?: string | null
): Promise<void> {
	if (!playlistId) {
		return;
	}

	const row = await db.query.playlist.findFirst({
		where: eq(playlist.id, playlistId),
		columns: { id: true },
	});

	if (!row) {
		throw new WatchProgressPlaylistNotFoundError();
	}
}

function clampPosition(lastPosition: number, duration: number): number {
	if (duration <= 0) {
		throw new WatchProgressValidationError(
			"duration must be greater than zero"
		);
	}
	if (lastPosition < 0) {
		throw new WatchProgressValidationError("lastPosition must be non-negative");
	}
	return Math.min(lastPosition, duration);
}

export async function saveWatchProgress(
	params: SaveWatchProgressParams
): Promise<ProgressEnvelope> {
	const { db, input } = params;

	await assertContentExists(db, input.contentId);
	await assertPlaylistExists(db, input.playlistId);

	const lastPosition = clampPosition(input.lastPosition, input.duration);
	const isCompleted = lastPosition / input.duration >= COMPLETION_THRESHOLD;

	const [saved] = await db
		.insert(watchProgress)
		.values({
			userId: input.userId,
			contentId: input.contentId,
			playlistId: input.playlistId ?? null,
			lastPosition,
			duration: input.duration,
			isCompleted,
			deviceType: input.deviceType ?? null,
		})
		.onConflictDoUpdate({
			target: [watchProgress.userId, watchProgress.contentId],
			set: {
				playlistId: input.playlistId ?? null,
				lastPosition,
				duration: input.duration,
				isCompleted,
				deviceType: input.deviceType ?? null,
				updatedAt: new Date(),
			},
		})
		.returning();

	if (!saved) {
		throw new Error("Failed to save watch progress");
	}

	return toEnvelope(saved);
}

export async function markWatchProgressCompleted(
	params: MarkWatchProgressCompletedParams
): Promise<ProgressEnvelope> {
	const { db, input } = params;

	await assertContentExists(db, input.contentId);
	await assertPlaylistExists(db, input.playlistId);

	const existing = await db.query.watchProgress.findFirst({
		where: and(
			eq(watchProgress.userId, input.userId),
			eq(watchProgress.contentId, input.contentId)
		),
	});

	const duration = input.duration ?? existing?.duration ?? 1;
	if (duration <= 0) {
		throw new WatchProgressValidationError(
			"duration must be greater than zero"
		);
	}

	const [saved] = await db
		.insert(watchProgress)
		.values({
			userId: input.userId,
			contentId: input.contentId,
			playlistId: input.playlistId ?? existing?.playlistId ?? null,
			lastPosition: duration,
			duration,
			isCompleted: true,
			deviceType: input.deviceType ?? existing?.deviceType ?? null,
		})
		.onConflictDoUpdate({
			target: [watchProgress.userId, watchProgress.contentId],
			set: {
				playlistId: input.playlistId ?? existing?.playlistId ?? null,
				lastPosition: duration,
				duration,
				isCompleted: true,
				deviceType: input.deviceType ?? existing?.deviceType ?? null,
				updatedAt: new Date(),
			},
		})
		.returning();

	if (!saved) {
		throw new Error("Failed to mark watch progress as completed");
	}

	return {
		progress: saved,
		progressPercent: 100,
	};
}

export async function getWatchProgressResume(
	params: GetWatchProgressResumeParams
): Promise<WatchProgressResumeResult | null> {
	const { db, input } = params;
	const row = await db.query.watchProgress.findFirst({
		where: and(
			eq(watchProgress.userId, input.userId),
			eq(watchProgress.contentId, input.contentId)
		),
	});

	if (!row) {
		return null;
	}

	return {
		...toEnvelope(row),
		resumePosition: row.lastPosition,
	};
}

export async function listContinueWatching(
	params: ListContinueWatchingParams
): Promise<ContinueWatchingResult> {
	const { db, input } = params;
	const page = input.page ?? 1;
	const limit = input.limit ?? 20;
	const offset = (page - 1) * limit;

	const where = and(
		eq(watchProgress.userId, input.userId),
		eq(watchProgress.isCompleted, false),
		eq(content.isDeleted, false),
		eq(content.isPublished, true),
		eq(content.isAvailable, true)
	);

	const countRows = await db
		.select({ total: count() })
		.from(watchProgress)
		.innerJoin(content, eq(watchProgress.contentId, content.id))
		.where(where);
	const total = Number(countRows[0]?.total ?? 0);

	const rows = await db
		.select({
			progress: watchProgress,
			content: {
				id: content.id,
				title: content.title,
				thumbnailImageId: content.thumbnailImageId,
				duration: content.duration,
				contentType: content.contentType,
				releaseDate: content.releaseDate,
			},
		})
		.from(watchProgress)
		.innerJoin(content, eq(watchProgress.contentId, content.id))
		.where(where)
		.orderBy(desc(watchProgress.updatedAt), desc(watchProgress.id))
		.limit(limit)
		.offset(offset);

	const items: ContinueWatchingItem[] = rows.map((row) => ({
		progress: row.progress,
		progressPercent: toProgressPercent(
			row.progress.lastPosition,
			row.progress.duration
		),
		content: row.content,
	}));

	return {
		items,
		pagination: {
			page,
			limit,
			total,
			totalPages: total === 0 ? 0 : Math.ceil(total / limit),
		},
	};
}
