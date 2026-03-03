import { and, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import type { DbClient } from "@/lib/db/orm";
import {
	content,
	playlist,
	playlistEpisode,
	userLibrary,
} from "@/lib/db/schema";
import type {
	GetMyPlaylistCollectionParams,
	HasLibraryAccessParams,
	LibraryContentItem,
	LibraryHasAccessResult,
	LibraryListMyItemsResult,
	LibraryPlaylistCollectionItem,
	LibraryPlaylistEpisode,
	ListMyLibraryItemsParams,
} from "./library.types";
import {
	LibraryAccessDeniedError,
	LibraryPlaylistNotFoundError,
} from "./library.types";

const orderPlaylistEpisodesBy = [
	sql`${playlistEpisode.seasonNumber} ASC NULLS LAST`,
	sql`${playlistEpisode.episodeOrder} ASC`,
	sql`${playlistEpisode.addedAt} ASC`,
	sql`${playlistEpisode.id} ASC`,
] as const;

function activeEntitlementCondition(userId: string, now: Date) {
	return and(
		eq(userLibrary.userId, userId),
		or(isNull(userLibrary.expiresAt), gt(userLibrary.expiresAt, now))
	);
}

function toPaging(input: { page?: number; limit?: number }) {
	const page = input.page ?? 1;
	const limit = input.limit ?? 20;
	const offset = (page - 1) * limit;
	return { page, limit, offset };
}

function listActiveEntitlements(
	db: DbClient,
	userId: string,
	now = new Date()
) {
	return db
		.select({
			id: userLibrary.id,
			contentId: userLibrary.contentId,
			playlistId: userLibrary.playlistId,
			orderId: userLibrary.orderId,
			acquiredAt: userLibrary.acquiredAt,
			expiresAt: userLibrary.expiresAt,
		})
		.from(userLibrary)
		.where(activeEntitlementCondition(userId, now))
		.orderBy(desc(userLibrary.acquiredAt), desc(userLibrary.id));
}

async function getContentSummaryMap(db: DbClient, contentIds: string[]) {
	if (contentIds.length === 0) {
		return new Map();
	}

	const rows = await db
		.select({
			id: content.id,
			title: content.title,
			description: content.description,
			duration: content.duration,
			releaseDate: content.releaseDate,
			contentType: content.contentType,
			thumbnailImageId: content.thumbnailImageId,
		})
		.from(content)
		.where(inArray(content.id, contentIds));

	return new Map(rows.map((row) => [row.id, row]));
}

async function getPlaylistSummaryMap(db: DbClient, playlistIds: string[]) {
	if (playlistIds.length === 0) {
		return new Map();
	}

	const rows = await db
		.select({
			id: playlist.id,
			creatorId: playlist.creatorId,
			title: playlist.title,
			description: playlist.description,
			thumbnailImageId: playlist.thumbnailImageId,
			isSeries: playlist.isSeries,
			createdAt: playlist.createdAt,
			updatedAt: playlist.updatedAt,
		})
		.from(playlist)
		.where(inArray(playlist.id, playlistIds));

	return new Map(rows.map((row) => [row.id, row]));
}

async function listAccessiblePlaylistEpisodes(params: {
	db: DbClient;
	playlistIds: string[];
	entitledContentIds: string[];
}): Promise<LibraryPlaylistEpisode[]> {
	const { db, playlistIds, entitledContentIds } = params;
	if (playlistIds.length === 0 || entitledContentIds.length === 0) {
		return [];
	}

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
				description: content.description,
				duration: content.duration,
				releaseDate: content.releaseDate,
				contentType: content.contentType,
				thumbnailImageId: content.thumbnailImageId,
			},
		})
		.from(playlistEpisode)
		.innerJoin(content, eq(playlistEpisode.contentId, content.id))
		.where(
			and(
				inArray(playlistEpisode.playlistId, playlistIds),
				inArray(playlistEpisode.contentId, entitledContentIds)
			)
		)
		.orderBy(...orderPlaylistEpisodesBy);

	const dedupe = new Set<string>();
	const episodes: LibraryPlaylistEpisode[] = [];
	for (const row of rows) {
		const key = `${row.playlistId}:${row.contentId}`;
		if (dedupe.has(key)) {
			continue;
		}
		dedupe.add(key);
		episodes.push(row);
	}

	return episodes;
}

export async function listMyLibraryItems(
	params: ListMyLibraryItemsParams
): Promise<LibraryListMyItemsResult> {
	const { db, userId, input } = params;
	const { page, limit, offset } = toPaging(input);
	const entitlements = await listActiveEntitlements(db, userId);

	const standaloneByContentId = new Map<
		string,
		(typeof entitlements)[number]
	>();
	const playlistById = new Map<string, (typeof entitlements)[number]>();
	const entitledContentIds = new Set<string>();

	for (const row of entitlements) {
		entitledContentIds.add(row.contentId);
		if (row.playlistId) {
			if (!playlistById.has(row.playlistId)) {
				playlistById.set(row.playlistId, row);
			}
			continue;
		}
		if (!standaloneByContentId.has(row.contentId)) {
			standaloneByContentId.set(row.contentId, row);
		}
	}

	const contentSummaryById = await getContentSummaryMap(
		db,
		Array.from(standaloneByContentId.keys())
	);
	const playlistIds = Array.from(playlistById.keys());
	const playlistSummaryById = await getPlaylistSummaryMap(db, playlistIds);
	const playlistEpisodes = await listAccessiblePlaylistEpisodes({
		db,
		playlistIds,
		entitledContentIds: Array.from(entitledContentIds),
	});

	const episodesByPlaylistId = new Map<string, LibraryPlaylistEpisode[]>();
	for (const episode of playlistEpisodes) {
		const current = episodesByPlaylistId.get(episode.playlistId) ?? [];
		current.push(episode);
		episodesByPlaylistId.set(episode.playlistId, current);
	}

	const contentItems: LibraryContentItem[] = [];
	for (const [contentId, entitlement] of standaloneByContentId.entries()) {
		const contentSummary = contentSummaryById.get(contentId);
		if (!contentSummary) {
			continue;
		}
		contentItems.push({
			type: "CONTENT",
			acquiredAt: entitlement.acquiredAt,
			expiresAt: entitlement.expiresAt,
			orderId: entitlement.orderId,
			content: contentSummary,
		});
	}

	const playlistItems: LibraryPlaylistCollectionItem[] = [];
	for (const [playlistId, entitlement] of playlistById.entries()) {
		const playlistSummary = playlistSummaryById.get(playlistId);
		if (!playlistSummary) {
			continue;
		}
		playlistItems.push({
			type: "PLAYLIST_COLLECTION",
			acquiredAt: entitlement.acquiredAt,
			expiresAt: entitlement.expiresAt,
			orderId: entitlement.orderId,
			playlist: playlistSummary,
			episodes: episodesByPlaylistId.get(playlistId) ?? [],
		});
	}

	const items = [...contentItems, ...playlistItems].sort((a, b) => {
		const byAcquiredAt = b.acquiredAt.getTime() - a.acquiredAt.getTime();
		if (byAcquiredAt !== 0) {
			return byAcquiredAt;
		}

		const aId = a.type === "CONTENT" ? a.content.id : a.playlist.id;
		const bId = b.type === "CONTENT" ? b.content.id : b.playlist.id;
		return aId.localeCompare(bId);
	});

	const total = items.length;
	const pagedItems = items.slice(offset, offset + limit);

	return {
		items: pagedItems,
		pagination: {
			page,
			limit,
			total,
			totalPages: total === 0 ? 0 : Math.ceil(total / limit),
		},
	};
}

export async function getMyPlaylistCollection(
	params: GetMyPlaylistCollectionParams
): Promise<LibraryPlaylistCollectionItem> {
	const { db, userId, input } = params;
	const playlistId = input.playlistId;
	const now = new Date();

	const playlistRow = await db.query.playlist.findFirst({
		where: eq(playlist.id, playlistId),
		columns: { id: true },
	});
	if (!playlistRow) {
		throw new LibraryPlaylistNotFoundError();
	}

	const entitlementRows = await db
		.select({
			id: userLibrary.id,
			contentId: userLibrary.contentId,
			orderId: userLibrary.orderId,
			acquiredAt: userLibrary.acquiredAt,
			expiresAt: userLibrary.expiresAt,
		})
		.from(userLibrary)
		.where(
			and(
				activeEntitlementCondition(userId, now),
				eq(userLibrary.playlistId, playlistId)
			)
		)
		.orderBy(desc(userLibrary.acquiredAt), desc(userLibrary.id));

	const latestEntitlement = entitlementRows[0];
	if (!latestEntitlement) {
		throw new LibraryAccessDeniedError();
	}

	const entitledContentIds = Array.from(
		new Set(entitlementRows.map((row) => row.contentId))
	);
	const playlistSummaryById = await getPlaylistSummaryMap(db, [playlistId]);
	const summary = playlistSummaryById.get(playlistId);
	if (!summary) {
		throw new LibraryPlaylistNotFoundError();
	}

	const episodes = await listAccessiblePlaylistEpisodes({
		db,
		playlistIds: [playlistId],
		entitledContentIds,
	});

	return {
		type: "PLAYLIST_COLLECTION",
		acquiredAt: latestEntitlement.acquiredAt,
		expiresAt: latestEntitlement.expiresAt,
		orderId: latestEntitlement.orderId,
		playlist: summary,
		episodes,
	};
}

export async function hasLibraryAccess(
	params: HasLibraryAccessParams
): Promise<LibraryHasAccessResult> {
	const { db, userId, input } = params;
	const now = new Date();

	const byContentId = input.contentId
		? await db.query.userLibrary.findFirst({
				where: and(
					activeEntitlementCondition(userId, now),
					eq(userLibrary.contentId, input.contentId)
				),
				columns: { id: true },
			})
		: null;

	if (byContentId) {
		return { hasAccess: true };
	}

	const byPlaylistId = input.playlistId
		? await db.query.userLibrary.findFirst({
				where: and(
					activeEntitlementCondition(userId, now),
					eq(userLibrary.playlistId, input.playlistId)
				),
				columns: { id: true },
			})
		: null;

	return {
		hasAccess: Boolean(byPlaylistId),
	};
}
