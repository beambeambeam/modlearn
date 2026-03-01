import type { content, playlistEpisode } from "@/lib/db/schema";

export interface PlaylistGetByIdInput {
	id: string;
}

export interface PlaylistListEpisodesInput {
	playlistId: string;
	seasonNumber?: number;
}

export interface PlaylistAdminCreateInput {
	title: string;
	description?: string | null;
	thumbnailImageId?: string | null;
	isSeries?: boolean;
}

export interface PlaylistAdminAddEpisodeInput {
	playlistId: string;
	contentId: string;
	episodeOrder?: number;
	seasonNumber?: number | null;
	episodeNumber?: number | null;
	title?: string | null;
}

export interface PlaylistAdminReorderEpisodesInput {
	playlistId: string;
	episodeIds: string[];
}

type PlaylistEpisodeRow = typeof playlistEpisode.$inferSelect;
type PlaylistContentSummary = Pick<
	typeof content.$inferSelect,
	| "id"
	| "title"
	| "description"
	| "duration"
	| "releaseDate"
	| "contentType"
	| "thumbnailImageId"
>;

export type PlaylistEpisodeWithContent = PlaylistEpisodeRow & {
	content: PlaylistContentSummary;
};

export interface PlaylistWithEpisodes {
	id: string;
	creatorId: string;
	title: string;
	description: string | null;
	thumbnailImageId: string | null;
	isSeries: boolean;
	createdAt: Date;
	updatedAt: Date;
	episodes: PlaylistEpisodeWithContent[];
}

export class PlaylistNotFoundError extends Error {
	constructor() {
		super("Playlist not found");
		this.name = "PlaylistNotFoundError";
	}
}

export class ContentNotFoundError extends Error {
	constructor() {
		super("Content not found");
		this.name = "ContentNotFoundError";
	}
}

export class PlaylistReorderValidationError extends Error {
	constructor(message = "Invalid reorder payload for playlist episodes") {
		super(message);
		this.name = "PlaylistReorderValidationError";
	}
}
