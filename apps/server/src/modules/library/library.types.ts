import type { DbClient } from "@/lib/db/orm";
import type { content, playlist, playlistEpisode } from "@/lib/db/schema";

export interface LibraryListMyItemsInput {
	page?: number;
	limit?: number;
}

export interface LibraryGetPlaylistCollectionInput {
	playlistId: string;
}

export interface LibraryHasAccessInput {
	contentId?: string;
	playlistId?: string;
}

export interface ListMyLibraryItemsParams {
	db: DbClient;
	userId: string;
	input: LibraryListMyItemsInput;
}

export interface GetMyPlaylistCollectionParams {
	db: DbClient;
	userId: string;
	input: LibraryGetPlaylistCollectionInput;
}

export interface HasLibraryAccessParams {
	db: DbClient;
	userId: string;
	input: LibraryHasAccessInput;
}

type LibraryContentSummary = Pick<
	typeof content.$inferSelect,
	| "id"
	| "title"
	| "description"
	| "duration"
	| "releaseDate"
	| "contentType"
	| "thumbnailImageId"
>;

type LibraryPlaylistSummary = Pick<
	typeof playlist.$inferSelect,
	| "id"
	| "creatorId"
	| "title"
	| "description"
	| "thumbnailImageId"
	| "isSeries"
	| "createdAt"
	| "updatedAt"
>;

export interface LibraryPlaylistEpisode
	extends Pick<
		typeof playlistEpisode.$inferSelect,
		| "id"
		| "playlistId"
		| "contentId"
		| "episodeOrder"
		| "seasonNumber"
		| "episodeNumber"
		| "title"
		| "addedAt"
	> {
	content: LibraryContentSummary;
}

export interface LibraryContentItem {
	type: "CONTENT";
	acquiredAt: Date;
	expiresAt: Date | null;
	orderId: string;
	content: LibraryContentSummary;
}

export interface LibraryPlaylistCollectionItem {
	type: "PLAYLIST_COLLECTION";
	acquiredAt: Date;
	expiresAt: Date | null;
	orderId: string;
	playlist: LibraryPlaylistSummary;
	episodes: LibraryPlaylistEpisode[];
}

export type LibraryItem = LibraryContentItem | LibraryPlaylistCollectionItem;

export interface LibraryListMyItemsResult {
	items: LibraryItem[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

export interface LibraryHasAccessResult {
	hasAccess: boolean;
}

export class LibraryPlaylistNotFoundError extends Error {
	constructor() {
		super("Playlist not found");
		this.name = "LibraryPlaylistNotFoundError";
	}
}

export class LibraryAccessDeniedError extends Error {
	constructor() {
		super("You do not have access to this playlist");
		this.name = "LibraryAccessDeniedError";
	}
}
