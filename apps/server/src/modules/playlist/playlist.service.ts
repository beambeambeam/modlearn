import {
	and,
	count,
	desc,
	eq,
	gte,
	ilike,
	inArray,
	isNull,
	lte,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import type { DbClient } from "@/lib/db/orm";
import {
	content,
	playlist,
	playlistEpisode,
	playlistPricing,
} from "@/lib/db/schema";
import type {
	ActivePricing,
	AddEpisodeToPlaylistParams,
	CreatePlaylistParams,
	DeletePlaylistParams,
	GetPlaylistByIdWithEpisodesParams,
	ListPlaylistEpisodesParams,
	ListPlaylistsParams,
	PlaylistDeleteResult,
	PlaylistEpisodeDeleteResult,
	PlaylistEpisodeWithContent,
	PlaylistListResult,
	PlaylistWithEpisodes,
	RemoveEpisodeFromPlaylistParams,
	ReorderPlaylistEpisodesParams,
	SetPlaylistAvailabilityParams,
	SetPlaylistPublishStateParams,
	UpdatePlaylistEpisodeParams,
	UpdatePlaylistParams,
} from "./playlist.types";
import {
	ContentNotFoundError,
	PlaylistEpisodeDuplicateContentError,
	PlaylistEpisodeNotFoundError,
	PlaylistNotFoundError,
	PlaylistReorderValidationError,
} from "./playlist.types";
import { episodesOrderBy, seasonBucketCondition } from "./playlist.utils";

function whereFromConditions(
	conditions: SQL<unknown>[]
): SQL<unknown> | undefined {
	if (conditions.length === 0) {
		return undefined;
	}

	return and(...conditions);
}

async function resolveActivePricing(params: {
	db: DbClient;
	playlistId: string;
	now?: Date;
}): Promise<ActivePricing | null> {
	const { db, playlistId, now = new Date() } = params;
	const todayDate = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
	);
	const row = await db.query.playlistPricing.findFirst({
		where: and(
			eq(playlistPricing.playlistId, playlistId),
			lte(playlistPricing.effectiveFrom, todayDate),
			or(
				isNull(playlistPricing.effectiveTo),
				gte(playlistPricing.effectiveTo, todayDate)
			)
		),
		orderBy: [
			desc(playlistPricing.effectiveFrom),
			desc(playlistPricing.createdAt),
		],
		columns: {
			price: true,
			currency: true,
		},
	});

	if (!row) {
		return null;
	}

	return {
		price: row.price,
		currency: row.currency.toUpperCase(),
	};
}

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

async function assertContentExists(
	db: DbClient,
	contentId: string
): Promise<void> {
	const row = await db.query.content.findFirst({
		where: eq(content.id, contentId),
		columns: {
			id: true,
		},
	});

	if (!row) {
		throw new ContentNotFoundError();
	}
}

async function assertUniqueEpisodeContent(params: {
	db: DbClient;
	playlistId: string;
	contentId: string;
	excludeEpisodeId?: string;
}): Promise<void> {
	const { db, playlistId, contentId, excludeEpisodeId } = params;
	const existing = await db.query.playlistEpisode.findFirst({
		where: and(
			eq(playlistEpisode.playlistId, playlistId),
			eq(playlistEpisode.contentId, contentId),
			excludeEpisodeId
				? sql`${playlistEpisode.id} <> ${excludeEpisodeId}`
				: undefined
		),
		columns: {
			id: true,
		},
	});

	if (existing) {
		throw new PlaylistEpisodeDuplicateContentError();
	}
}

async function maxOrderInBucket(params: {
	db: DbClient;
	playlistId: string;
	seasonNumber: number | null;
}): Promise<number> {
	const { db, playlistId, seasonNumber } = params;
	const [maxOrderRow] = await db
		.select({
			maxOrder: sql<number>`coalesce(max(${playlistEpisode.episodeOrder}), 0)`,
		})
		.from(playlistEpisode)
		.where(
			and(
				eq(playlistEpisode.playlistId, playlistId),
				seasonBucketCondition(seasonNumber)
			)
		);

	return Number(maxOrderRow?.maxOrder ?? 0);
}

function clampTargetOrder(
	requestedOrder: number | undefined,
	maxOrder: number
): number {
	const defaultOrder = maxOrder + 1;
	if (requestedOrder === undefined) {
		return defaultOrder;
	}

	return Math.max(1, Math.min(requestedOrder, maxOrder + 1));
}

async function compactBucketOrder(params: {
	db: DbClient;
	playlistId: string;
	seasonNumber: number | null;
}): Promise<void> {
	const { db, playlistId, seasonNumber } = params;
	const rows = await db
		.select({
			id: playlistEpisode.id,
		})
		.from(playlistEpisode)
		.where(
			and(
				eq(playlistEpisode.playlistId, playlistId),
				seasonBucketCondition(seasonNumber)
			)
		)
		.orderBy(
			sql`${playlistEpisode.episodeOrder} ASC`,
			sql`${playlistEpisode.id} ASC`
		);

	for (const [index, row] of rows.entries()) {
		await db
			.update(playlistEpisode)
			.set({
				episodeOrder: index + 1,
			})
			.where(eq(playlistEpisode.id, row.id));
	}
}

async function getPlaylistEpisodeOrThrow(
	db: DbClient,
	episodeId: string
): Promise<typeof playlistEpisode.$inferSelect> {
	const existing = await db.query.playlistEpisode.findFirst({
		where: eq(playlistEpisode.id, episodeId),
	});
	if (!existing) {
		throw new PlaylistEpisodeNotFoundError();
	}
	return existing;
}

function resolveEpisodePatch(params: {
	existing: typeof playlistEpisode.$inferSelect;
	input: UpdatePlaylistEpisodeParams["input"];
}) {
	const { existing, input } = params;
	const nextContentId = input.patch.contentId ?? existing.contentId;
	const nextSeasonNumber =
		input.patch.seasonNumber === undefined
			? existing.seasonNumber
			: input.patch.seasonNumber;
	const isSeasonChanged = nextSeasonNumber !== existing.seasonNumber;
	const isOrderChanged = input.patch.episodeOrder !== undefined;
	const shouldMoveOrder = isSeasonChanged || isOrderChanged;

	return {
		nextContentId,
		nextSeasonNumber,
		shouldMoveOrder,
	};
}

async function applyEpisodeOrderMove(params: {
	db: DbClient;
	existing: typeof playlistEpisode.$inferSelect;
	nextSeasonNumber: number | null;
	requestedOrder: number | undefined;
	shouldMoveOrder: boolean;
}): Promise<number> {
	const { db, existing, nextSeasonNumber, requestedOrder, shouldMoveOrder } =
		params;

	if (!shouldMoveOrder) {
		return existing.episodeOrder;
	}

	await db
		.update(playlistEpisode)
		.set({
			episodeOrder: sql`${playlistEpisode.episodeOrder} - 1`,
		})
		.where(
			and(
				eq(playlistEpisode.playlistId, existing.playlistId),
				seasonBucketCondition(existing.seasonNumber),
				sql`${playlistEpisode.episodeOrder} > ${existing.episodeOrder}`
			)
		);

	const targetMaxOrder = await maxOrderInBucket({
		db,
		playlistId: existing.playlistId,
		seasonNumber: nextSeasonNumber,
	});
	const nextOrder = clampTargetOrder(requestedOrder, targetMaxOrder);

	if (nextOrder <= targetMaxOrder) {
		await db
			.update(playlistEpisode)
			.set({
				episodeOrder: sql`${playlistEpisode.episodeOrder} + 1`,
			})
			.where(
				and(
					eq(playlistEpisode.playlistId, existing.playlistId),
					seasonBucketCondition(nextSeasonNumber),
					sql`${playlistEpisode.episodeOrder} >= ${nextOrder}`
				)
			);
	}

	return nextOrder;
}

async function compactEpisodeBucketsAfterMove(params: {
	db: DbClient;
	playlistId: string;
	previousSeasonNumber: number | null;
	nextSeasonNumber: number | null;
	shouldMoveOrder: boolean;
}): Promise<void> {
	const {
		db,
		playlistId,
		previousSeasonNumber,
		nextSeasonNumber,
		shouldMoveOrder,
	} = params;
	if (!shouldMoveOrder) {
		return;
	}

	await compactBucketOrder({
		db,
		playlistId,
		seasonNumber: previousSeasonNumber,
	});

	if (nextSeasonNumber !== previousSeasonNumber) {
		await compactBucketOrder({
			db,
			playlistId,
			seasonNumber: nextSeasonNumber,
		});
	}
}

async function queryVisibleEpisodes(
	db: DbClient,
	playlistId: string,
	seasonNumber?: number,
	onlyPublished = true
): Promise<PlaylistEpisodeWithContent[]> {
	const conditions: SQL<unknown>[] = [
		eq(playlistEpisode.playlistId, playlistId),
		eq(content.isDeleted, false),
	];
	if (onlyPublished) {
		conditions.push(
			eq(content.isPublished, true),
			eq(content.isAvailable, true)
		);
	}

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

function buildPlaylistFilters(input: {
	id?: string;
	search?: string;
	isSeries?: boolean;
	onlyPublished?: boolean;
}): SQL<unknown> | undefined {
	const conditions: SQL<unknown>[] = [];
	if (input.id) {
		conditions.push(eq(playlist.id, input.id));
	}
	if (input.search) {
		conditions.push(ilike(playlist.title, `%${input.search}%`));
	}
	if (input.isSeries !== undefined) {
		conditions.push(eq(playlist.isSeries, input.isSeries));
	}
	if (input.onlyPublished ?? false) {
		conditions.push(
			eq(playlist.isPublished, true),
			eq(playlist.isAvailable, true)
		);
	}

	return whereFromConditions(conditions);
}

export async function listPlaylists(
	params: ListPlaylistsParams
): Promise<PlaylistListResult> {
	const { db, input } = params;
	const page = input.page ?? 1;
	const limit = input.limit ?? 20;
	const offset = (page - 1) * limit;
	const filters = buildPlaylistFilters({
		search: input.search,
		isSeries: input.isSeries,
		onlyPublished: input.onlyPublished ?? false,
	});
	const countRows = await db
		.select({
			total: count(),
		})
		.from(playlist)
		.where(filters);
	const total = Number(countRows[0]?.total ?? 0);

	const items = await db
		.select()
		.from(playlist)
		.where(filters)
		.orderBy(desc(playlist.createdAt), desc(playlist.id))
		.limit(limit)
		.offset(offset);
	const itemsWithPricing = await Promise.all(
		items.map(async (item) => ({
			...item,
			activePricing: await resolveActivePricing({
				db,
				playlistId: item.id,
			}),
		}))
	);

	return {
		items: itemsWithPricing,
		pagination: {
			page,
			limit,
			total,
			totalPages: total === 0 ? 0 : Math.ceil(total / limit),
		},
	};
}

export async function getPlaylistByIdWithEpisodes(
	params: GetPlaylistByIdWithEpisodesParams
): Promise<PlaylistWithEpisodes> {
	const { db, input } = params;
	const playlistRow = await db.query.playlist.findFirst({
		where: buildPlaylistFilters({
			id: input.id,
			onlyPublished: input.onlyPublished ?? false,
		}),
	});

	if (!playlistRow) {
		throw new PlaylistNotFoundError();
	}

	const episodes = await queryVisibleEpisodes(
		db,
		input.id,
		undefined,
		input.onlyPublished ?? false
	);
	const activePricing = await resolveActivePricing({
		db,
		playlistId: playlistRow.id,
	});

	return {
		...playlistRow,
		activePricing,
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
			isPublished: false,
			publishedAt: null,
			isAvailable: true,
		})
		.returning();

	if (!created) {
		throw new Error("Failed to create playlist");
	}

	return created;
}

export async function updatePlaylist(
	params: UpdatePlaylistParams
): Promise<typeof playlist.$inferSelect> {
	const { db, input } = params;

	const [updated] = await db
		.update(playlist)
		.set({
			title: input.patch.title,
			description: input.patch.description,
			thumbnailImageId: input.patch.thumbnailImageId,
			isSeries: input.patch.isSeries,
		})
		.where(eq(playlist.id, input.id))
		.returning();

	if (!updated) {
		throw new PlaylistNotFoundError();
	}

	return updated;
}

export async function deletePlaylist(
	params: DeletePlaylistParams
): Promise<PlaylistDeleteResult> {
	const { db, input } = params;
	const [deleted] = await db
		.delete(playlist)
		.where(eq(playlist.id, input.id))
		.returning();

	if (!deleted) {
		throw new PlaylistNotFoundError();
	}

	return {
		id: deleted.id,
		deleted: true,
	};
}

export async function setPlaylistPublishState(
	params: SetPlaylistPublishStateParams
): Promise<typeof playlist.$inferSelect> {
	const { db, input } = params;
	const existing = await db.query.playlist.findFirst({
		where: eq(playlist.id, input.id),
	});
	if (!existing) {
		throw new PlaylistNotFoundError();
	}

	const [updated] = await db
		.update(playlist)
		.set({
			isPublished: input.isPublished,
			publishedAt: input.isPublished
				? (existing.publishedAt ?? new Date())
				: null,
		})
		.where(eq(playlist.id, input.id))
		.returning();
	if (!updated) {
		throw new PlaylistNotFoundError();
	}

	return updated;
}

export async function setPlaylistAvailability(
	params: SetPlaylistAvailabilityParams
): Promise<typeof playlist.$inferSelect> {
	const { db, input } = params;
	const [updated] = await db
		.update(playlist)
		.set({
			isAvailable: input.isAvailable,
		})
		.where(eq(playlist.id, input.id))
		.returning();
	if (!updated) {
		throw new PlaylistNotFoundError();
	}

	return updated;
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

		await assertContentExists(tx, input.contentId);
		await assertUniqueEpisodeContent({
			db: tx,
			playlistId: input.playlistId,
			contentId: input.contentId,
		});

		const seasonNumber = input.seasonNumber ?? null;
		const maxOrder = await maxOrderInBucket({
			db: tx,
			playlistId: input.playlistId,
			seasonNumber,
		});
		const targetOrder = clampTargetOrder(input.episodeOrder, maxOrder);

		if (targetOrder <= maxOrder) {
			await tx
				.update(playlistEpisode)
				.set({
					episodeOrder: sql`${playlistEpisode.episodeOrder} + 1`,
				})
				.where(
					and(
						eq(playlistEpisode.playlistId, input.playlistId),
						seasonBucketCondition(seasonNumber),
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

export function updatePlaylistEpisode(
	params: UpdatePlaylistEpisodeParams
): Promise<typeof playlistEpisode.$inferSelect> {
	const { db, input } = params;

	return db.transaction(async (tx) => {
		const existing = await getPlaylistEpisodeOrThrow(tx, input.id);
		const { nextContentId, nextSeasonNumber, shouldMoveOrder } =
			resolveEpisodePatch({
				existing,
				input,
			});

		if (input.patch.contentId !== undefined) {
			await assertContentExists(tx, nextContentId);
		}
		await assertUniqueEpisodeContent({
			db: tx,
			playlistId: existing.playlistId,
			contentId: nextContentId,
			excludeEpisodeId: existing.id,
		});

		const nextOrder = await applyEpisodeOrderMove({
			db: tx,
			existing,
			nextSeasonNumber,
			requestedOrder: input.patch.episodeOrder,
			shouldMoveOrder,
		});

		const [updated] = await tx
			.update(playlistEpisode)
			.set({
				contentId: nextContentId,
				seasonNumber: nextSeasonNumber,
				episodeOrder: nextOrder,
				episodeNumber:
					input.patch.episodeNumber === undefined
						? existing.episodeNumber
						: input.patch.episodeNumber,
				title:
					input.patch.title === undefined ? existing.title : input.patch.title,
			})
			.where(eq(playlistEpisode.id, existing.id))
			.returning();

		if (!updated) {
			throw new PlaylistEpisodeNotFoundError();
		}

		await compactEpisodeBucketsAfterMove({
			db: tx,
			playlistId: existing.playlistId,
			previousSeasonNumber: existing.seasonNumber,
			nextSeasonNumber,
			shouldMoveOrder,
		});

		return updated;
	});
}

export function removeEpisodeFromPlaylist(
	params: RemoveEpisodeFromPlaylistParams
): Promise<PlaylistEpisodeDeleteResult> {
	const { db, input } = params;
	return db.transaction(async (tx) => {
		const [deleted] = await tx
			.delete(playlistEpisode)
			.where(eq(playlistEpisode.id, input.id))
			.returning();

		if (!deleted) {
			throw new PlaylistEpisodeNotFoundError();
		}

		await compactBucketOrder({
			db: tx,
			playlistId: deleted.playlistId,
			seasonNumber: deleted.seasonNumber,
		});

		return {
			id: deleted.id,
			playlistId: deleted.playlistId,
			deleted: true,
		};
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
