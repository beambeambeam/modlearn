import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull, or, type SQL, sql } from "drizzle-orm";
import type { DbClient } from "@/lib/db/orm";
import {
	content,
	contentView,
	playbackEvent,
	playbackSession,
	playlist,
	playlistEpisode,
	storage,
	userLibrary,
	watchProgress,
} from "@/lib/db/schema";
import { generateDownloadUrl } from "@/lib/storage/s3-operations";
import {
	markWatchProgressCompleted,
	saveWatchProgress,
} from "@/modules/watch-progress/watch-progress.service";
import type {
	CreatePlaybackSessionParams,
	GetPlaybackSessionParams,
	PlaybackCreateSessionResult,
	PlaybackEventEnvelope,
	PlaybackLifecycleResult,
	PlaybackSessionState,
	RecordPlaybackPauseParams,
	RecordPlaybackPlayParams,
	RecordPlaybackResumeParams,
	RecordPlaybackSeekParams,
	RecordPlaybackStopParams,
} from "./playback.types";
import {
	PlaybackAccessDeniedError,
	PlaybackContentNotFoundError,
	PlaybackContentUnavailableError,
	PlaybackFileNotReadyError,
	PlaybackPlaylistNotFoundError,
	PlaybackSessionExpiredError,
	PlaybackSessionNotFoundError,
	PlaybackStateTransitionError,
	PlaybackTokenInvalidError,
	PlaybackValidationError,
} from "./playback.types";

const STORAGE_PROVIDER = "s3";
const TOKEN_TTL_MS = 15 * 60 * 1000;
const COMPLETION_THRESHOLD = 0.95;

function toProgressPercent(lastPosition: number, duration: number): number {
	if (duration <= 0) {
		return 0;
	}
	return Math.round((lastPosition / duration) * 100);
}

function clampPosition(lastPosition: number, duration: number): number {
	if (duration <= 0) {
		throw new PlaybackValidationError("duration must be greater than zero");
	}

	if (lastPosition < 0) {
		throw new PlaybackValidationError("position must be non-negative");
	}

	return Math.min(lastPosition, duration);
}

function isCompleted(lastPosition: number, duration: number): boolean {
	if (duration <= 0) {
		return false;
	}
	return lastPosition / duration >= COMPLETION_THRESHOLD;
}

function activeEntitlementCondition(userId: string, now: Date): SQL<unknown> {
	return (
		and(
			eq(userLibrary.userId, userId),
			or(isNull(userLibrary.expiresAt), gt(userLibrary.expiresAt, now))
		) ?? sql`true`
	);
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
		throw new PlaybackPlaylistNotFoundError();
	}
}

async function assertContentPlayable(db: DbClient, contentId: string) {
	const row = await db.query.content.findFirst({
		where: eq(content.id, contentId),
		columns: {
			id: true,
			title: true,
			duration: true,
			contentType: true,
			fileId: true,
			isDeleted: true,
			isPublished: true,
			isAvailable: true,
		},
	});

	if (!row || row.isDeleted) {
		throw new PlaybackContentNotFoundError();
	}

	if (!(row.isPublished && row.isAvailable)) {
		throw new PlaybackContentUnavailableError();
	}

	return row;
}

async function assertPlaylistContainsContent(params: {
	db: DbClient;
	playlistId?: string | null;
	contentId: string;
}) {
	const { db, playlistId, contentId } = params;
	if (!playlistId) {
		return;
	}

	const row = await db.query.playlistEpisode.findFirst({
		where: and(
			eq(playlistEpisode.playlistId, playlistId),
			eq(playlistEpisode.contentId, contentId)
		),
		columns: { id: true },
	});

	if (!row) {
		throw new PlaybackValidationError(
			"playlistId does not include the requested content"
		);
	}
}

async function assertPlaybackAccess(params: {
	db: DbClient;
	userId: string;
	contentId: string;
	now: Date;
}) {
	const { db, userId, contentId, now } = params;

	const row = await db.query.userLibrary.findFirst({
		where: and(
			activeEntitlementCondition(userId, now),
			eq(userLibrary.contentId, contentId)
		),
		columns: { id: true },
	});

	if (!row) {
		throw new PlaybackAccessDeniedError();
	}
}

async function getStorageKeyForContentFile(
	db: DbClient,
	fileId: string
): Promise<string> {
	const row = await db.query.storage.findFirst({
		where: and(
			eq(storage.fileId, fileId),
			eq(storage.storageProvider, STORAGE_PROVIDER)
		),
		columns: { storageKey: true },
	});

	if (!row) {
		throw new PlaybackFileNotReadyError();
	}

	return row.storageKey;
}

async function getResumePosition(params: {
	db: DbClient;
	userId: string;
	contentId: string;
	duration: number;
}): Promise<number> {
	const { db, userId, contentId, duration } = params;

	const row = await db.query.watchProgress.findFirst({
		where: and(
			eq(watchProgress.userId, userId),
			eq(watchProgress.contentId, contentId)
		),
		columns: { lastPosition: true },
	});

	if (!row) {
		return 0;
	}

	if (duration <= 0) {
		return Math.max(0, row.lastPosition);
	}

	return Math.min(Math.max(0, row.lastPosition), duration);
}

async function invalidateExistingActiveSessions(params: {
	db: DbClient;
	userId: string;
	contentId: string;
	deviceType?: string | null;
	now: Date;
}) {
	const { db, userId, contentId, deviceType, now } = params;

	const deviceCondition = deviceType
		? eq(playbackSession.deviceType, deviceType)
		: isNull(playbackSession.deviceType);

	await db
		.update(playbackSession)
		.set({
			status: "EXPIRED",
			endedAt: now,
			lastEventAt: now,
			updatedAt: now,
		})
		.where(
			and(
				eq(playbackSession.userId, userId),
				eq(playbackSession.contentId, contentId),
				deviceCondition,
				or(
					eq(playbackSession.status, "ACTIVE"),
					eq(playbackSession.status, "PAUSED")
				)
			)
		);
}

async function loadSessionForLifecycle(params: {
	db: DbClient;
	sessionId: string;
	playbackToken: string;
	userId: string;
	now: Date;
}) {
	const { db, sessionId, playbackToken, userId, now } = params;
	const row = await db.query.playbackSession.findFirst({
		where: eq(playbackSession.id, sessionId),
	});

	if (!row) {
		throw new PlaybackSessionNotFoundError();
	}

	if (row.userId !== userId) {
		throw new PlaybackAccessDeniedError();
	}

	if (row.playbackToken !== playbackToken) {
		throw new PlaybackTokenInvalidError();
	}

	if (row.expiresAt.getTime() <= now.getTime()) {
		await db
			.update(playbackSession)
			.set({
				status: "EXPIRED",
				endedAt: row.endedAt ?? now,
				lastEventAt: now,
				updatedAt: now,
			})
			.where(eq(playbackSession.id, row.id));
		throw new PlaybackSessionExpiredError();
	}

	return row;
}

function buildLifecycleUpdate(params: {
	eventType: "PLAY" | "PAUSE" | "RESUME" | "SEEK" | "STOP";
	currentStatus: (typeof playbackSession.$inferSelect)["status"];
	now: Date;
	position: number;
	duration: number;
	deviceType?: string | null;
}): Partial<typeof playbackSession.$inferInsert> {
	const { eventType, currentStatus, now, position, duration, deviceType } =
		params;

	switch (eventType) {
		case "PLAY": {
			if (currentStatus === "STOPPED" || currentStatus === "ENDED") {
				throw new PlaybackStateTransitionError("Cannot play a stopped session");
			}
			return {
				status: "ACTIVE",
				endedAt: null,
				lastPosition: position,
				duration,
				deviceType: deviceType ?? null,
				lastEventAt: now,
				updatedAt: now,
			};
		}
		case "PAUSE": {
			if (currentStatus !== "ACTIVE") {
				throw new PlaybackStateTransitionError(
					"Pause requires an active session"
				);
			}
			return {
				status: "PAUSED",
				lastPosition: position,
				duration,
				deviceType: deviceType ?? null,
				lastEventAt: now,
				updatedAt: now,
			};
		}
		case "RESUME": {
			if (currentStatus !== "PAUSED") {
				throw new PlaybackStateTransitionError(
					"Resume requires a paused session"
				);
			}
			return {
				status: "ACTIVE",
				lastPosition: position,
				duration,
				deviceType: deviceType ?? null,
				lastEventAt: now,
				updatedAt: now,
			};
		}
		case "SEEK": {
			if (currentStatus !== "ACTIVE" && currentStatus !== "PAUSED") {
				throw new PlaybackStateTransitionError(
					"Seek requires an active or paused session"
				);
			}
			return {
				lastPosition: position,
				duration,
				deviceType: deviceType ?? null,
				lastEventAt: now,
				updatedAt: now,
			};
		}
		case "STOP": {
			if (currentStatus !== "ACTIVE" && currentStatus !== "PAUSED") {
				throw new PlaybackStateTransitionError(
					"Stop requires an active or paused session"
				);
			}
			return {
				status: "STOPPED",
				endedAt: now,
				lastPosition: position,
				duration,
				deviceType: deviceType ?? null,
				lastEventAt: now,
				updatedAt: now,
			};
		}
		default: {
			throw new PlaybackStateTransitionError("Unsupported playback event type");
		}
	}
}

function toSessionState(
	session: typeof playbackSession.$inferSelect
): PlaybackSessionState {
	const progressPercent = toProgressPercent(
		session.lastPosition,
		session.duration
	);
	return {
		session,
		progressPercent,
		isCompleted: isCompleted(session.lastPosition, session.duration),
	};
}

async function syncWatchProgress(params: {
	db: DbClient;
	userId: string;
	contentId: string;
	playlistId?: string | null;
	position: number;
	duration: number;
	deviceType?: string | null;
	stopEvent: boolean;
}) {
	const {
		db,
		userId,
		contentId,
		playlistId,
		position,
		duration,
		deviceType,
		stopEvent,
	} = params;

	if (stopEvent && isCompleted(position, duration)) {
		await markWatchProgressCompleted({
			db,
			input: {
				userId,
				contentId,
				playlistId,
				duration,
				deviceType,
			},
		});
		return;
	}

	await saveWatchProgress({
		db,
		input: {
			userId,
			contentId,
			playlistId,
			lastPosition: position,
			duration,
			deviceType,
		},
	});
}

async function recordCompletionAnalytics(params: {
	db: DbClient;
	session: typeof playbackSession.$inferSelect;
	position: number;
	duration: number;
	deviceType?: string | null;
}) {
	const { db, session, position, duration, deviceType } = params;
	if (!isCompleted(position, duration)) {
		return;
	}

	await db.insert(contentView).values({
		contentId: session.contentId,
		userId: session.userId,
		sessionId: null,
		watchDuration: position,
		deviceType: deviceType ?? session.deviceType ?? null,
	});

	await db
		.update(content)
		.set({ viewCount: sql`${content.viewCount} + 1` })
		.where(eq(content.id, session.contentId));
}

async function executeLifecycleEvent(params: {
	db: DbClient;
	input: {
		userId: string;
		sessionId: string;
		playbackToken: string;
		position: number;
		duration: number;
		deviceType?: string | null;
	};
	eventType: "PLAY" | "PAUSE" | "RESUME" | "SEEK" | "STOP";
}): Promise<PlaybackLifecycleResult> {
	const { db, input, eventType } = params;
	const now = new Date();

	const session = await loadSessionForLifecycle({
		db,
		sessionId: input.sessionId,
		playbackToken: input.playbackToken,
		userId: input.userId,
		now,
	});

	const position = clampPosition(input.position, input.duration);

	const updateValues = buildLifecycleUpdate({
		eventType,
		currentStatus: session.status,
		now,
		position,
		duration: input.duration,
		deviceType: input.deviceType,
	});

	const [updatedSession] = await db
		.update(playbackSession)
		.set(updateValues)
		.where(eq(playbackSession.id, session.id))
		.returning();

	if (!updatedSession) {
		throw new PlaybackSessionNotFoundError();
	}

	const [event] = await db
		.insert(playbackEvent)
		.values({
			sessionId: updatedSession.id,
			eventType,
			position,
			duration: input.duration,
			deviceType: input.deviceType ?? updatedSession.deviceType ?? null,
		})
		.returning();

	if (!event) {
		throw new Error("Failed to record playback event");
	}

	await syncWatchProgress({
		db,
		userId: updatedSession.userId,
		contentId: updatedSession.contentId,
		playlistId: updatedSession.playlistId,
		position,
		duration: input.duration,
		deviceType: input.deviceType ?? updatedSession.deviceType ?? null,
		stopEvent: eventType === "STOP",
	});

	if (eventType === "STOP") {
		await recordCompletionAnalytics({
			db,
			session: updatedSession,
			position,
			duration: input.duration,
			deviceType: input.deviceType,
		});
	}

	const envelope: PlaybackEventEnvelope = {
		event,
		session: updatedSession,
		progressPercent: toProgressPercent(position, input.duration),
		isCompleted: isCompleted(position, input.duration),
	};

	return envelope;
}

export async function createPlaybackSession(
	params: CreatePlaybackSessionParams
): Promise<PlaybackCreateSessionResult> {
	const { db, input } = params;
	const now = new Date();

	await assertPlaylistExists(db, input.playlistId);
	const playableContent = await assertContentPlayable(db, input.contentId);
	await assertPlaylistContainsContent({
		db,
		playlistId: input.playlistId,
		contentId: input.contentId,
	});

	await assertPlaybackAccess({
		db,
		userId: input.userId,
		contentId: input.contentId,
		now,
	});

	if (!playableContent.fileId) {
		throw new PlaybackFileNotReadyError();
	}

	const storageKey = await getStorageKeyForContentFile(
		db,
		playableContent.fileId
	);
	const signedDownload = await generateDownloadUrl({
		key: storageKey,
		inline: true,
	});

	const duration = playableContent.duration ?? 0;
	const resumePosition = await getResumePosition({
		db,
		userId: input.userId,
		contentId: input.contentId,
		duration,
	});

	await invalidateExistingActiveSessions({
		db,
		userId: input.userId,
		contentId: input.contentId,
		deviceType: input.deviceType,
		now,
	});

	const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS);
	const token = `${randomUUID()}.${randomUUID()}`;

	const [created] = await db
		.insert(playbackSession)
		.values({
			userId: input.userId,
			contentId: input.contentId,
			playlistId: input.playlistId ?? null,
			playbackToken: token,
			status: "ACTIVE",
			startedAt: now,
			lastEventAt: now,
			lastPosition: resumePosition,
			duration,
			deviceType: input.deviceType ?? null,
			expiresAt,
		})
		.returning();

	if (!created) {
		throw new Error("Failed to create playback session");
	}

	return {
		sessionId: created.id,
		playbackToken: created.playbackToken,
		streamUrl: signedDownload.downloadUrl,
		streamUrlExpiresAt: signedDownload.expiresAt,
		tokenExpiresAt: created.expiresAt,
		resumePosition,
		content: {
			id: playableContent.id,
			title: playableContent.title,
			duration: playableContent.duration,
			contentType: playableContent.contentType,
			fileId: playableContent.fileId,
		},
	};
}

export function recordPlaybackPlay(
	params: RecordPlaybackPlayParams
): Promise<PlaybackLifecycleResult> {
	return executeLifecycleEvent({
		db: params.db,
		input: params.input,
		eventType: "PLAY",
	});
}

export function recordPlaybackPause(
	params: RecordPlaybackPauseParams
): Promise<PlaybackLifecycleResult> {
	return executeLifecycleEvent({
		db: params.db,
		input: params.input,
		eventType: "PAUSE",
	});
}

export function recordPlaybackResume(
	params: RecordPlaybackResumeParams
): Promise<PlaybackLifecycleResult> {
	return executeLifecycleEvent({
		db: params.db,
		input: params.input,
		eventType: "RESUME",
	});
}

export function recordPlaybackSeek(
	params: RecordPlaybackSeekParams
): Promise<PlaybackLifecycleResult> {
	return executeLifecycleEvent({
		db: params.db,
		input: params.input,
		eventType: "SEEK",
	});
}

export function recordPlaybackStop(
	params: RecordPlaybackStopParams
): Promise<PlaybackLifecycleResult> {
	return executeLifecycleEvent({
		db: params.db,
		input: params.input,
		eventType: "STOP",
	});
}

export async function getPlaybackSession(
	params: GetPlaybackSessionParams
): Promise<PlaybackSessionState> {
	const { db, input } = params;
	const now = new Date();
	const session = await loadSessionForLifecycle({
		db,
		sessionId: input.sessionId,
		playbackToken: input.playbackToken,
		userId: input.userId,
		now,
	});

	return toSessionState(session);
}
