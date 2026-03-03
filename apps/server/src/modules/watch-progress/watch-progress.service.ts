import { asc, count, desc, sql } from "drizzle-orm";
import type { DbClient } from "@/lib/db/orm";
import { and, eq } from "@/lib/db/orm";

import {
	content,
	playlist,
	playlistContent,
	playlistEpisode,
	watchProgress,
} from "@/lib/db/schema";
import type {
	ContinueWatchingItem,
	ContinueWatchingResult,
	GetPlaylistAutoPlayNextParams,
	GetPlaylistWatchProgressResumeParams,
	GetWatchProgressResumeParams,
	ListContinueWatchingParams,
	MarkWatchProgressCompletedParams,
	PlaylistAutoPlayNextResult,
	PlaylistEpisodeProgressSummary,
	PlaylistWatchProgressResumeResult,
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

function normalizeResumePosition(params: {
	lastPosition: number;
	duration: number | null;
}): number {
	const { lastPosition, duration } = params;
	if (duration === null || duration <= 0) {
		return Math.max(0, lastPosition);
	}
	return Math.min(Math.max(0, lastPosition), duration);
}

async function setLatestPlaylistContent(params: {
	db: DbClient;
	userId: string;
	playlistId?: string | null;
	contentId: string;
}): Promise<void> {
	const { db, userId, playlistId, contentId } = params;
	if (!playlistId) {
		return;
	}

	await db
		.update(playlistContent)
		.set({
			isLatestWatched: false,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(playlistContent.userId, userId),
				eq(playlistContent.playlistId, playlistId),
				eq(playlistContent.isLatestWatched, true)
			)
		);

	const existing = await db.query.playlistContent.findFirst({
		where: and(
			eq(playlistContent.userId, userId),
			eq(playlistContent.playlistId, playlistId),
			eq(playlistContent.contentId, contentId)
		),
		columns: { id: true },
		orderBy: [desc(playlistContent.updatedAt), desc(playlistContent.id)],
	});

	if (existing) {
		await db
			.update(playlistContent)
			.set({
				isLatestWatched: true,
				updatedAt: new Date(),
			})
			.where(eq(playlistContent.id, existing.id));
		return;
	}

	await db.insert(playlistContent).values({
		userId,
		playlistId,
		contentId,
		isLatestWatched: true,
	});
}

async function listVisiblePlaylistEpisodes(
	db: DbClient,
	playlistId: string
): Promise<PlaylistEpisodeProgressSummary[]> {
	const rows = await db
		.select({
			id: playlistEpisode.id,
			playlistId: playlistEpisode.playlistId,
			contentId: playlistEpisode.contentId,
			episodeOrder: playlistEpisode.episodeOrder,
			seasonNumber: playlistEpisode.seasonNumber,
			episodeNumber: playlistEpisode.episodeNumber,
			title: playlistEpisode.title,
			addedAt: playlistEpisode.addedAt,
			content: {
				id: content.id,
				title: content.title,
				thumbnailImageId: content.thumbnailImageId,
				duration: content.duration,
				contentType: content.contentType,
				releaseDate: content.releaseDate,
			},
		})
		.from(playlistEpisode)
		.innerJoin(content, eq(playlistEpisode.contentId, content.id))
		.where(
			and(
				eq(playlistEpisode.playlistId, playlistId),
				eq(content.isDeleted, false),
				eq(content.isPublished, true),
				eq(content.isAvailable, true)
			)
		)
		.orderBy(
			sql`${playlistEpisode.seasonNumber} ASC NULLS LAST`,
			asc(playlistEpisode.episodeOrder),
			asc(playlistEpisode.addedAt),
			asc(playlistEpisode.id)
		);

	return rows;
}

export async function saveWatchProgress(
	params: SaveWatchProgressParams
): Promise<ProgressEnvelope> {
	const { db, input } = params;

	await assertContentExists(db, input.contentId);
	await assertPlaylistExists(db, input.playlistId);

	const lastPosition = clampPosition(input.lastPosition, input.duration);
	const isCompleted = lastPosition / input.duration >= COMPLETION_THRESHOLD;

	const saved = await db.transaction(async (tx) => {
		const [row] = await tx
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

		if (!row) {
			throw new Error("Failed to save watch progress");
		}

		await setLatestPlaylistContent({
			db: tx,
			userId: input.userId,
			playlistId: input.playlistId,
			contentId: input.contentId,
		});

		return row;
	});

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

	const resolvedPlaylistId = input.playlistId ?? existing?.playlistId ?? null;
	const saved = await db.transaction(async (tx) => {
		const [row] = await tx
			.insert(watchProgress)
			.values({
				userId: input.userId,
				contentId: input.contentId,
				playlistId: resolvedPlaylistId,
				lastPosition: duration,
				duration,
				isCompleted: true,
				deviceType: input.deviceType ?? existing?.deviceType ?? null,
			})
			.onConflictDoUpdate({
				target: [watchProgress.userId, watchProgress.contentId],
				set: {
					playlistId: resolvedPlaylistId,
					lastPosition: duration,
					duration,
					isCompleted: true,
					deviceType: input.deviceType ?? existing?.deviceType ?? null,
					updatedAt: new Date(),
				},
			})
			.returning();

		if (!row) {
			throw new Error("Failed to mark watch progress as completed");
		}

		await setLatestPlaylistContent({
			db: tx,
			userId: input.userId,
			playlistId: resolvedPlaylistId,
			contentId: input.contentId,
		});

		return row;
	});

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

export async function getPlaylistWatchProgressResume(
	params: GetPlaylistWatchProgressResumeParams
): Promise<PlaylistWatchProgressResumeResult | null> {
	const { db, input } = params;
	await assertPlaylistExists(db, input.playlistId);

	const episodes = await listVisiblePlaylistEpisodes(db, input.playlistId);
	if (episodes.length === 0) {
		return null;
	}

	const latest = await db.query.playlistContent.findFirst({
		where: and(
			eq(playlistContent.userId, input.userId),
			eq(playlistContent.playlistId, input.playlistId),
			eq(playlistContent.isLatestWatched, true)
		),
		columns: {
			contentId: true,
		},
		orderBy: [desc(playlistContent.updatedAt), desc(playlistContent.id)],
	});

	const lastWatchedContentId = latest?.contentId ?? null;
	const firstEpisode = episodes[0];
	if (!firstEpisode) {
		return null;
	}

	if (!lastWatchedContentId) {
		return {
			playlistId: input.playlistId,
			currentEpisode: firstEpisode,
			resumePosition: 0,
			nextEpisode: episodes[1] ?? null,
			isPlaylistCompleted: false,
			lastWatchedContentId: null,
		};
	}

	const lastEpisodeIndex = episodes.findIndex(
		(episode) => episode.contentId === lastWatchedContentId
	);

	if (lastEpisodeIndex < 0) {
		return {
			playlistId: input.playlistId,
			currentEpisode: firstEpisode,
			resumePosition: 0,
			nextEpisode: episodes[1] ?? null,
			isPlaylistCompleted: false,
			lastWatchedContentId,
		};
	}

	const lastProgress = await db.query.watchProgress.findFirst({
		where: and(
			eq(watchProgress.userId, input.userId),
			eq(watchProgress.contentId, lastWatchedContentId)
		),
		columns: {
			lastPosition: true,
			duration: true,
			isCompleted: true,
		},
	});

	const lastEpisode = episodes[lastEpisodeIndex];
	if (!lastEpisode) {
		return {
			playlistId: input.playlistId,
			currentEpisode: firstEpisode,
			resumePosition: 0,
			nextEpisode: episodes[1] ?? null,
			isPlaylistCompleted: false,
			lastWatchedContentId,
		};
	}
	const nextFromLast = episodes[lastEpisodeIndex + 1] ?? null;
	const isLastEpisodeCompleted = Boolean(lastProgress?.isCompleted);

	if (isLastEpisodeCompleted && nextFromLast) {
		return {
			playlistId: input.playlistId,
			currentEpisode: nextFromLast,
			resumePosition: 0,
			nextEpisode: episodes[lastEpisodeIndex + 2] ?? null,
			isPlaylistCompleted: false,
			lastWatchedContentId,
		};
	}

	if (isLastEpisodeCompleted && !nextFromLast) {
		return {
			playlistId: input.playlistId,
			currentEpisode: lastEpisode,
			resumePosition: 0,
			nextEpisode: null,
			isPlaylistCompleted: true,
			lastWatchedContentId,
		};
	}

	return {
		playlistId: input.playlistId,
		currentEpisode: lastEpisode,
		resumePosition: normalizeResumePosition({
			lastPosition: lastProgress?.lastPosition ?? 0,
			duration: lastEpisode.content.duration,
		}),
		nextEpisode: nextFromLast,
		isPlaylistCompleted: false,
		lastWatchedContentId,
	};
}

export async function getPlaylistAutoPlayNext(
	params: GetPlaylistAutoPlayNextParams
): Promise<PlaylistAutoPlayNextResult> {
	const { db, input } = params;
	await assertPlaylistExists(db, input.playlistId);

	const episodes = await listVisiblePlaylistEpisodes(db, input.playlistId);
	const currentIndex = episodes.findIndex(
		(episode) => episode.contentId === input.contentId
	);

	if (currentIndex < 0) {
		throw new WatchProgressValidationError(
			"contentId does not belong to a playable episode in this playlist"
		);
	}

	const nextEpisode = episodes[currentIndex + 1] ?? null;
	return {
		playlistId: input.playlistId,
		contentId: input.contentId,
		nextEpisode,
		isPlaylistCompleted: nextEpisode === null,
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
