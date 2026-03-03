import type { DbClient } from "@/lib/db/orm";
import type { content, playbackEvent, playbackSession } from "@/lib/db/schema";

export interface PlaybackCreateSessionInput {
	userId: string;
	contentId: string;
	playlistId?: string | null;
	deviceType?: string | null;
}

export interface PlaybackLifecycleInput {
	userId: string;
	sessionId: string;
	playbackToken: string;
	position: number;
	duration: number;
	deviceType?: string | null;
}

export interface PlaybackSeekInput extends PlaybackLifecycleInput {
	fromPosition?: number;
}

export interface PlaybackGetSessionInput {
	userId: string;
	sessionId: string;
	playbackToken: string;
}

export interface CreatePlaybackSessionParams {
	db: DbClient;
	input: PlaybackCreateSessionInput;
}

export interface RecordPlaybackPlayParams {
	db: DbClient;
	input: PlaybackLifecycleInput;
}

export interface RecordPlaybackPauseParams {
	db: DbClient;
	input: PlaybackLifecycleInput;
}

export interface RecordPlaybackResumeParams {
	db: DbClient;
	input: PlaybackLifecycleInput;
}

export interface RecordPlaybackSeekParams {
	db: DbClient;
	input: PlaybackSeekInput;
}

export interface RecordPlaybackStopParams {
	db: DbClient;
	input: PlaybackLifecycleInput;
}

export interface GetPlaybackSessionParams {
	db: DbClient;
	input: PlaybackGetSessionInput;
}

export interface PlaybackSessionState {
	session: typeof playbackSession.$inferSelect;
	progressPercent: number;
	isCompleted: boolean;
}

type PlaybackContentSummary = Pick<
	typeof content.$inferSelect,
	"id" | "title" | "duration" | "contentType" | "fileId"
>;

export interface PlaybackCreateSessionResult {
	sessionId: string;
	playbackToken: string;
	streamUrl: string;
	streamUrlExpiresAt: Date;
	tokenExpiresAt: Date;
	resumePosition: number;
	content: PlaybackContentSummary;
}

export interface PlaybackEventEnvelope {
	event: typeof playbackEvent.$inferSelect;
	session: typeof playbackSession.$inferSelect;
	progressPercent: number;
	isCompleted: boolean;
}

export type PlaybackLifecycleResult = PlaybackEventEnvelope;

export class PlaybackContentNotFoundError extends Error {
	constructor() {
		super("Content not found");
		this.name = "PlaybackContentNotFoundError";
	}
}

export class PlaybackPlaylistNotFoundError extends Error {
	constructor() {
		super("Playlist not found");
		this.name = "PlaybackPlaylistNotFoundError";
	}
}

export class PlaybackContentUnavailableError extends Error {
	constructor() {
		super("Content is not available for playback");
		this.name = "PlaybackContentUnavailableError";
	}
}

export class PlaybackAccessDeniedError extends Error {
	constructor() {
		super("You do not have access to this content");
		this.name = "PlaybackAccessDeniedError";
	}
}

export class PlaybackFileNotReadyError extends Error {
	constructor() {
		super("Content file is not ready for playback");
		this.name = "PlaybackFileNotReadyError";
	}
}

export class PlaybackSessionNotFoundError extends Error {
	constructor() {
		super("Playback session not found");
		this.name = "PlaybackSessionNotFoundError";
	}
}

export class PlaybackTokenInvalidError extends Error {
	constructor() {
		super("Invalid playback token");
		this.name = "PlaybackTokenInvalidError";
	}
}

export class PlaybackSessionExpiredError extends Error {
	constructor() {
		super("Playback session expired");
		this.name = "PlaybackSessionExpiredError";
	}
}

export class PlaybackStateTransitionError extends Error {
	constructor(message = "Invalid playback state transition") {
		super(message);
		this.name = "PlaybackStateTransitionError";
	}
}

export class PlaybackValidationError extends Error {
	constructor(message = "Invalid playback input") {
		super(message);
		this.name = "PlaybackValidationError";
	}
}
