import { and, eq, inArray, type SQL, sql } from "drizzle-orm";
import type { DbClient } from "@/lib/db/orm";
import { content, playlist, playlistEpisode } from "@/lib/db/schema";
import type {
	AddEpisodeToPlaylistParams,
	CreatePlaylistParams,
	GetPlaylistByIdWithEpisodesParams,
	ListPlaylistEpisodesParams,
	PlaylistEpisodeWithContent,
	PlaylistWithEpisodes,
	ReorderPlaylistEpisodesParams,
} from "./playlist.types";
import {
	ContentNotFoundError,
	PlaylistNotFoundError,
	PlaylistReorderValidationError,
} from "./playlist.types";
import { episodesOrderBy, seasonBucketCondition } from "./playlist.utils";

async function assertPlaylistExists(
	db: DbClient,
	playlistId: string
): Promise<void> {
	const row = await db.query.playlist.findFirst({
		where: eq(playlist.id, playlistId),
		columns: {
			id: true,
		},
	});

	if (!row) {
		throw new PlaylistNotFoundError();
	}
}

async function queryVisibleEpisodes(
	db: DbClient,
	playlistId: string,
	seasonNumber?: number
): Promise<PlaylistEpisodeWithContent[]> {
	const conditions: SQL<unknown>[] = [
		eq(playlistEpisode.playlistId, playlistId),
		eq(content.isPublished, true),
		eq(content.isAvailable, true),
	];

	if (seasonNumber !== undefined) {
		conditions.push(eq(playlistEpisode.seasonNumber, seasonNumber));
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
		.where(and(...conditions))
		.orderBy(...episodesOrderBy());

	return rows;
}

export async function getPlaylistByIdWithEpisodes(
	params: GetPlaylistByIdWithEpisodesParams
): Promise<PlaylistWithEpisodes> {
	const { db, input } = params;
	const playlistRow = await db.query.playlist.findFirst({
		where: eq(playlist.id, input.id),
	});

	if (!playlistRow) {
		throw new PlaylistNotFoundError();
	}

	const episodes = await queryVisibleEpisodes(db, input.id);

	return {
		...playlistRow,
		episodes,
	};
}

export async function listPlaylistEpisodes(
	params: ListPlaylistEpisodesParams
): Promise<PlaylistEpisodeWithContent[]> {
	const { db, input } = params;
	await assertPlaylistExists(db, input.playlistId);

	return queryVisibleEpisodes(db, input.playlistId, input.seasonNumber);
}

export async function createPlaylist(
	params: CreatePlaylistParams
): Promise<typeof playlist.$inferSelect> {
	const { db, input, creatorId } = params;
	const [created] = await db
		.insert(playlist)
		.values({
			creatorId,
			title: input.title,
			description: input.description ?? null,
			thumbnailImageId: input.thumbnailImageId ?? null,
			isSeries: input.isSeries ?? true,
		})
		.returning();

	if (!created) {
		throw new Error("Failed to create playlist");
	}

	return created;
}

export function addEpisodeToPlaylist(
	params: AddEpisodeToPlaylistParams
): Promise<typeof playlistEpisode.$inferSelect> {
	const { db, input } = params;

	return db.transaction(async (tx) => {
		const playlistRow = await tx.query.playlist.findFirst({
			where: eq(playlist.id, input.playlistId),
			columns: { id: true },
		});
		if (!playlistRow) {
			throw new PlaylistNotFoundError();
		}

		const contentRow = await tx.query.content.findFirst({
			where: eq(content.id, input.contentId),
			columns: { id: true },
		});
		if (!contentRow) {
			throw new ContentNotFoundError();
		}

		const seasonNumber = input.seasonNumber ?? null;
		const bucketCondition = seasonBucketCondition(seasonNumber);

		const [maxOrderRow] = await tx
			.select({
				maxOrder: sql<number>`coalesce(max(${playlistEpisode.episodeOrder}), 0)`,
			})
			.from(playlistEpisode)
			.where(
				and(eq(playlistEpisode.playlistId, input.playlistId), bucketCondition)
			);

		const maxOrder = Number(maxOrderRow?.maxOrder ?? 0);
		const targetOrder = input.episodeOrder ?? maxOrder + 1;

		if (input.episodeOrder !== undefined) {
			await tx
				.update(playlistEpisode)
				.set({
					episodeOrder: sql`${playlistEpisode.episodeOrder} + 1`,
				})
				.where(
					and(
						eq(playlistEpisode.playlistId, input.playlistId),
						bucketCondition,
						sql`${playlistEpisode.episodeOrder} >= ${targetOrder}`
					)
				);
		}

		const [inserted] = await tx
			.insert(playlistEpisode)
			.values({
				playlistId: input.playlistId,
				contentId: input.contentId,
				episodeOrder: targetOrder,
				seasonNumber,
				episodeNumber: input.episodeNumber ?? null,
				title: input.title ?? null,
			})
			.returning();

		if (!inserted) {
			throw new Error("Failed to add episode to playlist");
		}

		return inserted;
	});
}

export async function reorderPlaylistEpisodes(
	params: ReorderPlaylistEpisodesParams
): Promise<(typeof playlistEpisode.$inferSelect)[]> {
	const { db, input } = params;

	await assertPlaylistExists(db, input.playlistId);

	const existing = await db
		.select({
			id: playlistEpisode.id,
		})
		.from(playlistEpisode)
		.where(eq(playlistEpisode.playlistId, input.playlistId));

	const existingIds = existing.map((row) => row.id);
	const existingSet = new Set(existingIds);
	const incomingSet = new Set(input.episodeIds);

	if (incomingSet.size !== input.episodeIds.length) {
		throw new PlaylistReorderValidationError(
			"Duplicate episode IDs are not allowed"
		);
	}

	if (existingIds.length !== input.episodeIds.length) {
		throw new PlaylistReorderValidationError(
			"Episode IDs must match playlist episode set exactly"
		);
	}

	for (const id of input.episodeIds) {
		if (!existingSet.has(id)) {
			throw new PlaylistReorderValidationError(
				"Episode IDs must match playlist episode set exactly"
			);
		}
	}

	return db.transaction(async (tx) => {
		for (const [index, episodeId] of input.episodeIds.entries()) {
			await tx
				.update(playlistEpisode)
				.set({ episodeOrder: index + 1 })
				.where(
					and(
						eq(playlistEpisode.id, episodeId),
						eq(playlistEpisode.playlistId, input.playlistId)
					)
				);
		}

		const rows = await tx
			.select()
			.from(playlistEpisode)
			.where(inArray(playlistEpisode.id, input.episodeIds));

		const rank = new Map(input.episodeIds.map((id, index) => [id, index]));
		return rows.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
	});
}
