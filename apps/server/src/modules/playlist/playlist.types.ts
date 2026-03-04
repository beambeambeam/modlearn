import type { DbClient } from "@/lib/db/orm";
import type { content, playlist, playlistEpisode } from "@/lib/db/schema";

export interface PlaylistGetByIdInput {
	id: string;
}

export interface PlaylistAdminGetByIdInput extends PlaylistGetByIdInput {
	onlyPublished?: boolean;
}

export interface PlaylistListEpisodesInput {
	playlistId: string;
	seasonNumber?: number;
}

export interface PlaylistListInput {
	page?: number;
	limit?: number;
	search?: string;
	isSeries?: boolean;
}

export interface PlaylistAdminListInput extends PlaylistListInput {
	onlyPublished?: boolean;
}

export interface PlaylistAdminCreateInput {
	title: string;
	description?: string | null;
	thumbnailImageId?: string | null;
	isSeries?: boolean;
}

export interface PlaylistAdminUpdateInput {
	id: string;
	patch: {
		title?: string;
		description?: string | null;
		thumbnailImageId?: string | null;
		isSeries?: boolean;
	};
}

export interface PlaylistAdminDeleteInput {
	id: string;
}

export interface PlaylistAdminSetPublishStateInput {
	id: string;
	isPublished: boolean;
}

export interface PlaylistAdminSetAvailabilityInput {
	id: string;
	isAvailable: boolean;
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

export interface PlaylistAdminUpdateEpisodeInput {
	id: string;
	patch: {
		contentId?: string;
		episodeOrder?: number;
		seasonNumber?: number | null;
		episodeNumber?: number | null;
		title?: string | null;
	};
}

export interface PlaylistAdminRemoveEpisodeInput {
	id: string;
}

export interface GetPlaylistByIdWithEpisodesParams {
	db: DbClient;
	input: PlaylistAdminGetByIdInput;
}

export interface ListPlaylistsParams {
	db: DbClient;
	input: PlaylistAdminListInput;
}

export interface ListPlaylistEpisodesParams {
	db: DbClient;
	input: PlaylistListEpisodesInput;
}

export interface CreatePlaylistParams {
	db: DbClient;
	input: PlaylistAdminCreateInput;
	creatorId: string;
}

export interface UpdatePlaylistParams {
	db: DbClient;
	input: PlaylistAdminUpdateInput;
}

export interface DeletePlaylistParams {
	db: DbClient;
	input: PlaylistAdminDeleteInput;
}

export interface SetPlaylistPublishStateParams {
	db: DbClient;
	input: PlaylistAdminSetPublishStateInput;
}

export interface SetPlaylistAvailabilityParams {
	db: DbClient;
	input: PlaylistAdminSetAvailabilityInput;
}

export interface AddEpisodeToPlaylistParams {
	db: DbClient;
	input: PlaylistAdminAddEpisodeInput;
}

export interface UpdatePlaylistEpisodeParams {
	db: DbClient;
	input: PlaylistAdminUpdateEpisodeInput;
}

export interface RemoveEpisodeFromPlaylistParams {
	db: DbClient;
	input: PlaylistAdminRemoveEpisodeInput;
}

export interface ReorderPlaylistEpisodesParams {
	db: DbClient;
	input: PlaylistAdminReorderEpisodesInput;
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

export interface ActivePricing {
	price: string;
	currency: string;
}

type PlaylistRow = typeof playlist.$inferSelect;
export type PlaylistWithActivePricing = PlaylistRow & {
	activePricing: ActivePricing | null;
};

export interface PlaylistWithEpisodes {
	id: string;
	creatorId: string;
	title: string;
	description: string | null;
	thumbnailImageId: string | null;
	isSeries: boolean;
	isPublished: boolean;
	publishedAt: Date | null;
	isAvailable: boolean;
	createdAt: Date;
	updatedAt: Date;
	activePricing: ActivePricing | null;
	episodes: PlaylistEpisodeWithContent[];
}

export interface PlaylistListResult {
	items: PlaylistWithActivePricing[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

export interface PlaylistDeleteResult {
	id: string;
	deleted: true;
}

export interface PlaylistEpisodeDeleteResult {
	id: string;
	playlistId: string;
	deleted: true;
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

export class PlaylistEpisodeNotFoundError extends Error {
	constructor() {
		super("Playlist episode not found");
		this.name = "PlaylistEpisodeNotFoundError";
	}
}

export class PlaylistEpisodeDuplicateContentError extends Error {
	constructor() {
		super("Content is already added to this playlist");
		this.name = "PlaylistEpisodeDuplicateContentError";
	}
}
