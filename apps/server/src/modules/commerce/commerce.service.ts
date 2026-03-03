import { and, desc, eq, gt, gte, inArray, isNull, lte, or } from "drizzle-orm";
import type { DbClient } from "@/lib/db/orm";
import {
	content,
	contentPricing,
	playlist,
	playlistEpisode,
	playlistPricing,
	userLibrary,
} from "@/lib/db/schema";
import {
	type CommerceActivePriceQuery,
	type CommerceCartAddItemInput,
	CommerceContentNotFoundError,
	CommerceCurrencyMismatchError,
	CommerceInvalidCartItemError,
	CommerceItemAlreadyOwnedError,
	type CommerceItemType,
	type CommerceOwnershipQuery,
	CommercePlaylistEmptyError,
	CommercePlaylistNotFoundError,
	CommercePriceNotFoundError,
	type CommercePriceSnapshot,
} from "./commerce.types";

const CURRENCY_SCALE = 100;

function toCents(amount: string): number {
	const numeric = Number(amount);
	if (!Number.isFinite(numeric)) {
		throw new Error(`Invalid money amount: ${amount}`);
	}
	return Math.round(numeric * CURRENCY_SCALE);
}

function fromCents(cents: number): string {
	return (cents / CURRENCY_SCALE).toFixed(2);
}

export function computeCartTotal(prices: string[]): string {
	const cents = prices.reduce((sum, value) => sum + toCents(value), 0);
	return fromCents(cents);
}

export function assertSingleCurrency(currencies: string[]): string | null {
	if (currencies.length === 0) {
		return null;
	}

	const normalized = currencies.map((currency) => currency.toUpperCase());
	const first = normalized[0];
	if (!first) {
		throw new CommerceCurrencyMismatchError();
	}

	for (const currency of normalized) {
		if (currency !== first) {
			throw new CommerceCurrencyMismatchError();
		}
	}

	return first;
}

export function validateCartAddItemInput(
	input: CommerceCartAddItemInput
): CommerceCartAddItemInput {
	if (input.itemType === "CONTENT") {
		if (!input.contentId || input.playlistId) {
			throw new CommerceInvalidCartItemError(
				"CONTENT item requires contentId only"
			);
		}
		return input;
	}

	if (!input.playlistId || input.contentId) {
		throw new CommerceInvalidCartItemError(
			"PLAYLIST item requires playlistId only"
		);
	}

	return input;
}

export async function assertContentExists(db: DbClient, contentId: string) {
	const row = await db.query.content.findFirst({
		where: and(eq(content.id, contentId), eq(content.isDeleted, false)),
		columns: { id: true },
	});

	if (!row) {
		throw new CommerceContentNotFoundError();
	}
}

export async function assertPlaylistExists(db: DbClient, playlistId: string) {
	const row = await db.query.playlist.findFirst({
		where: eq(playlist.id, playlistId),
		columns: { id: true },
	});

	if (!row) {
		throw new CommercePlaylistNotFoundError();
	}
}

export async function listPlaylistEpisodeContentIds(
	db: DbClient,
	playlistId: string
): Promise<string[]> {
	const rows = await db
		.select({ contentId: playlistEpisode.contentId })
		.from(playlistEpisode)
		.where(eq(playlistEpisode.playlistId, playlistId))
		.orderBy(playlistEpisode.seasonNumber, playlistEpisode.episodeOrder);

	const unique = new Set<string>();
	for (const row of rows) {
		unique.add(row.contentId);
	}

	return Array.from(unique);
}

export async function resolveActiveContentPrice(
	query: CommerceActivePriceQuery
): Promise<CommercePriceSnapshot> {
	const { db, contentId, now = new Date() } = query;
	if (!contentId) {
		throw new CommerceInvalidCartItemError("contentId is required");
	}

	const row = await db.query.contentPricing.findFirst({
		where: and(
			eq(contentPricing.contentId, contentId),
			lte(contentPricing.effectiveFrom, now),
			or(
				isNull(contentPricing.effectiveTo),
				gt(contentPricing.effectiveTo, now)
			)
		),
		orderBy: [
			desc(contentPricing.effectiveFrom),
			desc(contentPricing.createdAt),
		],
	});

	if (!row) {
		throw new CommercePriceNotFoundError();
	}

	return {
		itemType: "CONTENT",
		contentId,
		playlistId: null,
		price: row.price,
		currency: row.currency.toUpperCase(),
	};
}

export async function resolveActivePlaylistPrice(
	query: CommerceActivePriceQuery
): Promise<CommercePriceSnapshot> {
	const { db, playlistId, now = new Date() } = query;
	if (!playlistId) {
		throw new CommerceInvalidCartItemError("playlistId is required");
	}

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
	});

	if (!row) {
		throw new CommercePriceNotFoundError();
	}

	return {
		itemType: "PLAYLIST",
		contentId: null,
		playlistId,
		price: row.price,
		currency: row.currency.toUpperCase(),
	};
}

export function resolveActivePrice(
	query: CommerceActivePriceQuery & { itemType: CommerceItemType }
): Promise<CommercePriceSnapshot> {
	if (query.itemType === "CONTENT") {
		return resolveActiveContentPrice(query);
	}
	return resolveActivePlaylistPrice(query);
}

export async function listOwnedContentIds(params: {
	db: DbClient;
	userId: string;
	contentIds: string[];
	now?: Date;
}): Promise<Set<string>> {
	const { db, userId, contentIds, now = new Date() } = params;
	if (contentIds.length === 0) {
		return new Set();
	}

	const rows = await db
		.select({ contentId: userLibrary.contentId })
		.from(userLibrary)
		.where(
			and(
				eq(userLibrary.userId, userId),
				inArray(userLibrary.contentId, contentIds),
				or(isNull(userLibrary.expiresAt), gt(userLibrary.expiresAt, now))
			)
		);

	return new Set(rows.map((row) => row.contentId));
}

export async function hasActiveContentOwnership(
	query: CommerceOwnershipQuery
): Promise<boolean> {
	const { db, userId, contentId, now = new Date() } = query;
	if (!contentId) {
		throw new CommerceInvalidCartItemError("contentId is required");
	}

	const rows = await db
		.select({ id: userLibrary.id })
		.from(userLibrary)
		.where(
			and(
				eq(userLibrary.userId, userId),
				eq(userLibrary.contentId, contentId),
				or(isNull(userLibrary.expiresAt), gt(userLibrary.expiresAt, now))
			)
		)
		.limit(1);

	return rows.length > 0;
}

export async function hasFullPlaylistOwnership(
	query: CommerceOwnershipQuery
): Promise<boolean> {
	const { db, userId, playlistId, now = new Date() } = query;
	if (!playlistId) {
		throw new CommerceInvalidCartItemError("playlistId is required");
	}

	const episodeContentIds = await listPlaylistEpisodeContentIds(db, playlistId);
	if (episodeContentIds.length === 0) {
		throw new CommercePlaylistEmptyError();
	}

	const ownedIds = await listOwnedContentIds({
		db,
		userId,
		contentIds: episodeContentIds,
		now,
	});

	for (const contentId of episodeContentIds) {
		if (!ownedIds.has(contentId)) {
			return false;
		}
	}

	return true;
}

export async function assertNotAlreadyOwned(params: {
	db: DbClient;
	userId: string;
	itemType: CommerceItemType;
	contentId?: string;
	playlistId?: string;
	now?: Date;
}): Promise<void> {
	const { db, userId, itemType, contentId, playlistId, now } = params;
	if (itemType === "CONTENT") {
		const owned = await hasActiveContentOwnership({
			db,
			userId,
			contentId,
			now,
		});
		if (owned) {
			throw new CommerceItemAlreadyOwnedError();
		}
		return;
	}

	const owned = await hasFullPlaylistOwnership({
		db,
		userId,
		playlistId,
		now,
	});
	if (owned) {
		throw new CommerceItemAlreadyOwnedError();
	}
}
