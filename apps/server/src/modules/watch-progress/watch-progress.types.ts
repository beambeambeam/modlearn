import type { DbClient } from "@/lib/db/orm";
import type { content, watchProgress } from "@/lib/db/schema";

export interface WatchProgressSaveInput {
	userId: string;
	contentId: string;
	playlistId?: string | null;
	lastPosition: number;
	duration: number;
	deviceType?: string | null;
}

export interface WatchProgressMarkCompletedInput {
	userId: string;
	contentId: string;
	playlistId?: string | null;
	duration?: number;
	deviceType?: string | null;
}

export interface WatchProgressGetResumeInput {
	userId: string;
	contentId: string;
}

export interface WatchProgressContinueWatchingInput {
	userId: string;
	page?: number;
	limit?: number;
}

export interface SaveWatchProgressParams {
	db: DbClient;
	input: WatchProgressSaveInput;
}

export interface MarkWatchProgressCompletedParams {
	db: DbClient;
	input: WatchProgressMarkCompletedInput;
}

export interface GetWatchProgressResumeParams {
	db: DbClient;
	input: WatchProgressGetResumeInput;
}

export interface ListContinueWatchingParams {
	db: DbClient;
	input: WatchProgressContinueWatchingInput;
}

export interface ProgressEnvelope {
	progress: typeof watchProgress.$inferSelect;
	progressPercent: number;
}

export interface WatchProgressResumeResult extends ProgressEnvelope {
	resumePosition: number;
}

type ContinueWatchingContentSummary = Pick<
	typeof content.$inferSelect,
	| "id"
	| "title"
	| "thumbnailImageId"
	| "duration"
	| "contentType"
	| "releaseDate"
>;

export interface ContinueWatchingItem extends ProgressEnvelope {
	content: ContinueWatchingContentSummary;
}

export interface ContinueWatchingResult {
	items: ContinueWatchingItem[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

export class WatchProgressContentNotFoundError extends Error {
	constructor() {
		super("Content not found");
		this.name = "WatchProgressContentNotFoundError";
	}
}

export class WatchProgressPlaylistNotFoundError extends Error {
	constructor() {
		super("Playlist not found");
		this.name = "WatchProgressPlaylistNotFoundError";
	}
}

export class WatchProgressValidationError extends Error {
	constructor(message = "Invalid watch progress input") {
		super(message);
		this.name = "WatchProgressValidationError";
	}
}
