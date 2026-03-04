import { randomUUID } from "node:crypto";
import {
	and,
	count,
	desc,
	eq,
	gt,
	gte,
	inArray,
	isNull,
	lt,
	lte,
	ne,
	or,
} from "drizzle-orm";
import type { DbClient } from "@/lib/db/orm";
import {
	cart,
	cartItem,
	content,
	contentPricing,
	contentPurchase,
	order,
	orderItem,
	payment,
	playlist,
	playlistEpisode,
	playlistPricing,
	userLibrary,
} from "@/lib/db/schema";
import {
	type CommerceActivePriceQuery,
	type CommerceBuyContentInput,
	type CommerceBuyPlaylistInput,
	type CommerceBuyView,
	type CommerceCartAddItemInput,
	type CommerceCartRemoveItemInput,
	type CommerceCartView,
	type CommerceCheckoutCreateOrderInput,
	type CommerceCheckoutOrderView,
	CommerceContentNotFoundError,
	type CommerceContentPricingCreateInput,
	type CommerceContentPricingListInput,
	type CommerceContentPricingListView,
	type CommerceContentPricingUpdateInput,
	type CommerceContentPricingWindowView,
	CommerceCurrencyMismatchError,
	CommerceDuplicateCartItemError,
	CommerceInvalidCartItemError,
	CommerceItemAlreadyOwnedError,
	type CommerceItemType,
	CommerceOrderNotFoundError,
	CommerceOrderStateError,
	type CommerceOwnershipQuery,
	CommercePaymentConflictError,
	type CommercePaymentMarkSuccessInput,
	type CommercePaymentRefundInput,
	type CommercePaymentSuccessView,
	CommercePlaylistEmptyError,
	CommercePlaylistNotFoundError,
	type CommercePlaylistPricingCreateInput,
	type CommercePlaylistPricingListInput,
	type CommercePlaylistPricingListView,
	type CommercePlaylistPricingUpdateInput,
	type CommercePlaylistPricingWindowView,
	CommercePriceNotFoundError,
	type CommercePriceSnapshot,
	CommercePricingWindowNotFoundError,
	CommercePricingWindowOverlapError,
	CommercePricingWindowValidationError,
	type CommerceRefundView,
} from "./commerce.types";

const CURRENCY_SCALE = 100;

function toCents(amount: string): number {
	const numeric = Number(amount);
	if (!Number.isFinite(numeric)) {
		throw new Error(`Invalid money amount: ${amount}`);
	}
	return Math.round(numeric * CURRENCY_SCALE);
}

function buildProviderTransactionId(seed?: string): string {
	return seed ?? `mock-${randomUUID()}`;
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

function toContentPricingWindowView(params: {
	row: typeof contentPricing.$inferSelect;
	now?: Date;
}): CommerceContentPricingWindowView {
	const { row, now = new Date() } = params;
	const isActive =
		row.effectiveFrom <= now &&
		(row.effectiveTo === null || row.effectiveTo > now);
	return {
		id: row.id,
		contentId: row.contentId,
		price: row.price,
		currency: row.currency.toUpperCase(),
		effectiveFrom: row.effectiveFrom,
		effectiveTo: row.effectiveTo,
		createdBy: row.createdBy,
		createdAt: row.createdAt,
		isActive,
	};
}

function toPlaylistPricingWindowView(params: {
	row: typeof playlistPricing.$inferSelect;
	now?: Date;
}): CommercePlaylistPricingWindowView {
	const { row, now = new Date() } = params;
	const todayDate = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
	);
	const isActive =
		row.effectiveFrom <= todayDate &&
		(row.effectiveTo === null || row.effectiveTo >= todayDate);
	return {
		id: row.id,
		playlistId: row.playlistId,
		price: row.price,
		currency: row.currency.toUpperCase(),
		effectiveFrom: row.effectiveFrom,
		effectiveTo: row.effectiveTo,
		createdBy: row.createdBy,
		createdAt: row.createdAt,
		isActive,
	};
}

function assertContentPricingWindowValidity(params: {
	effectiveFrom: Date;
	effectiveTo: Date | null;
}) {
	const { effectiveFrom, effectiveTo } = params;
	if (effectiveTo && effectiveTo <= effectiveFrom) {
		throw new CommercePricingWindowValidationError(
			"effectiveTo must be greater than effectiveFrom"
		);
	}
}

function assertPlaylistPricingWindowValidity(params: {
	effectiveFrom: Date;
	effectiveTo: Date | null;
}) {
	const { effectiveFrom, effectiveTo } = params;
	if (effectiveTo && effectiveTo < effectiveFrom) {
		throw new CommercePricingWindowValidationError(
			"effectiveTo must be greater than or equal to effectiveFrom"
		);
	}
}

async function assertNoContentPricingOverlap(params: {
	db: DbClient;
	contentId: string;
	effectiveFrom: Date;
	effectiveTo: Date | null;
	excludeId?: string;
}) {
	const { db, contentId, effectiveFrom, effectiveTo, excludeId } = params;
	const overlap = await db.query.contentPricing.findFirst({
		where: and(
			eq(contentPricing.contentId, contentId),
			excludeId ? ne(contentPricing.id, excludeId) : undefined,
			effectiveTo ? lt(contentPricing.effectiveFrom, effectiveTo) : undefined,
			or(
				isNull(contentPricing.effectiveTo),
				gt(contentPricing.effectiveTo, effectiveFrom)
			)
		),
		columns: { id: true },
	});

	if (overlap) {
		throw new CommercePricingWindowOverlapError();
	}
}

async function assertNoPlaylistPricingOverlap(params: {
	db: DbClient;
	playlistId: string;
	effectiveFrom: Date;
	effectiveTo: Date | null;
	excludeId?: string;
}) {
	const { db, playlistId, effectiveFrom, effectiveTo, excludeId } = params;
	const overlap = await db.query.playlistPricing.findFirst({
		where: and(
			eq(playlistPricing.playlistId, playlistId),
			excludeId ? ne(playlistPricing.id, excludeId) : undefined,
			effectiveTo ? lte(playlistPricing.effectiveFrom, effectiveTo) : undefined,
			or(
				isNull(playlistPricing.effectiveTo),
				gte(playlistPricing.effectiveTo, effectiveFrom)
			)
		),
		columns: { id: true },
	});

	if (overlap) {
		throw new CommercePricingWindowOverlapError();
	}
}

export async function listContentPricingWindows(params: {
	db: DbClient;
	input: CommerceContentPricingListInput;
}): Promise<CommerceContentPricingListView> {
	const { db, input } = params;
	const page = input.page ?? 1;
	const limit = input.limit ?? 20;
	const offset = (page - 1) * limit;
	await assertContentExists(db, input.contentId);

	const [countRow] = await db
		.select({ total: count() })
		.from(contentPricing)
		.where(eq(contentPricing.contentId, input.contentId));
	const total = Number(countRow?.total ?? 0);

	const rows = await db.query.contentPricing.findMany({
		where: eq(contentPricing.contentId, input.contentId),
		orderBy: [
			desc(contentPricing.effectiveFrom),
			desc(contentPricing.createdAt),
			desc(contentPricing.id),
		],
		limit,
		offset,
	});

	return {
		items: rows.map((row) => toContentPricingWindowView({ row })),
		pagination: {
			page,
			limit,
			total,
			totalPages: total === 0 ? 0 : Math.ceil(total / limit),
		},
	};
}

export async function createContentPricingWindow(params: {
	db: DbClient;
	createdBy: string;
	input: CommerceContentPricingCreateInput;
}): Promise<CommerceContentPricingWindowView> {
	const { db, createdBy, input } = params;
	await assertContentExists(db, input.contentId);
	const effectiveTo = input.effectiveTo ?? null;
	assertContentPricingWindowValidity({
		effectiveFrom: input.effectiveFrom,
		effectiveTo,
	});
	await assertNoContentPricingOverlap({
		db,
		contentId: input.contentId,
		effectiveFrom: input.effectiveFrom,
		effectiveTo,
	});

	const [created] = await db
		.insert(contentPricing)
		.values({
			contentId: input.contentId,
			price: input.price,
			currency: input.currency.toUpperCase(),
			effectiveFrom: input.effectiveFrom,
			effectiveTo,
			createdBy,
		})
		.returning();

	if (!created) {
		throw new Error("Failed to create content pricing window");
	}

	return toContentPricingWindowView({ row: created });
}

export async function updateContentPricingWindow(params: {
	db: DbClient;
	input: CommerceContentPricingUpdateInput;
}): Promise<CommerceContentPricingWindowView> {
	const { db, input } = params;
	const existing = await db.query.contentPricing.findFirst({
		where: eq(contentPricing.id, input.id),
	});
	if (!existing) {
		throw new CommercePricingWindowNotFoundError();
	}

	const nextEffectiveFrom = input.patch.effectiveFrom ?? existing.effectiveFrom;
	const nextEffectiveTo =
		input.patch.effectiveTo === undefined
			? existing.effectiveTo
			: input.patch.effectiveTo;
	assertContentPricingWindowValidity({
		effectiveFrom: nextEffectiveFrom,
		effectiveTo: nextEffectiveTo,
	});
	await assertNoContentPricingOverlap({
		db,
		contentId: existing.contentId,
		effectiveFrom: nextEffectiveFrom,
		effectiveTo: nextEffectiveTo,
		excludeId: existing.id,
	});

	const [updated] = await db
		.update(contentPricing)
		.set({
			price: input.patch.price ?? existing.price,
			currency:
				input.patch.currency?.toUpperCase() ?? existing.currency.toUpperCase(),
			effectiveFrom: nextEffectiveFrom,
			effectiveTo: nextEffectiveTo,
		})
		.where(eq(contentPricing.id, input.id))
		.returning();

	if (!updated) {
		throw new CommercePricingWindowNotFoundError();
	}

	return toContentPricingWindowView({ row: updated });
}

export async function listPlaylistPricingWindows(params: {
	db: DbClient;
	input: CommercePlaylistPricingListInput;
}): Promise<CommercePlaylistPricingListView> {
	const { db, input } = params;
	const page = input.page ?? 1;
	const limit = input.limit ?? 20;
	const offset = (page - 1) * limit;
	await assertPlaylistExists(db, input.playlistId);

	const [countRow] = await db
		.select({ total: count() })
		.from(playlistPricing)
		.where(eq(playlistPricing.playlistId, input.playlistId));
	const total = Number(countRow?.total ?? 0);

	const rows = await db.query.playlistPricing.findMany({
		where: eq(playlistPricing.playlistId, input.playlistId),
		orderBy: [
			desc(playlistPricing.effectiveFrom),
			desc(playlistPricing.createdAt),
			desc(playlistPricing.id),
		],
		limit,
		offset,
	});

	return {
		items: rows.map((row) => toPlaylistPricingWindowView({ row })),
		pagination: {
			page,
			limit,
			total,
			totalPages: total === 0 ? 0 : Math.ceil(total / limit),
		},
	};
}

export async function createPlaylistPricingWindow(params: {
	db: DbClient;
	createdBy: string;
	input: CommercePlaylistPricingCreateInput;
}): Promise<CommercePlaylistPricingWindowView> {
	const { db, createdBy, input } = params;
	await assertPlaylistExists(db, input.playlistId);
	const effectiveTo = input.effectiveTo ?? null;
	assertPlaylistPricingWindowValidity({
		effectiveFrom: input.effectiveFrom,
		effectiveTo,
	});
	await assertNoPlaylistPricingOverlap({
		db,
		playlistId: input.playlistId,
		effectiveFrom: input.effectiveFrom,
		effectiveTo,
	});

	const [created] = await db
		.insert(playlistPricing)
		.values({
			playlistId: input.playlistId,
			price: input.price,
			currency: input.currency.toUpperCase(),
			effectiveFrom: input.effectiveFrom,
			effectiveTo,
			createdBy,
		})
		.returning();

	if (!created) {
		throw new Error("Failed to create playlist pricing window");
	}

	return toPlaylistPricingWindowView({ row: created });
}

export async function updatePlaylistPricingWindow(params: {
	db: DbClient;
	input: CommercePlaylistPricingUpdateInput;
}): Promise<CommercePlaylistPricingWindowView> {
	const { db, input } = params;
	const existing = await db.query.playlistPricing.findFirst({
		where: eq(playlistPricing.id, input.id),
	});
	if (!existing) {
		throw new CommercePricingWindowNotFoundError();
	}

	const nextEffectiveFrom = input.patch.effectiveFrom ?? existing.effectiveFrom;
	const nextEffectiveTo =
		input.patch.effectiveTo === undefined
			? existing.effectiveTo
			: input.patch.effectiveTo;
	assertPlaylistPricingWindowValidity({
		effectiveFrom: nextEffectiveFrom,
		effectiveTo: nextEffectiveTo,
	});
	await assertNoPlaylistPricingOverlap({
		db,
		playlistId: existing.playlistId,
		effectiveFrom: nextEffectiveFrom,
		effectiveTo: nextEffectiveTo,
		excludeId: existing.id,
	});

	const [updated] = await db
		.update(playlistPricing)
		.set({
			price: input.patch.price ?? existing.price,
			currency:
				input.patch.currency?.toUpperCase() ?? existing.currency.toUpperCase(),
			effectiveFrom: nextEffectiveFrom,
			effectiveTo: nextEffectiveTo,
		})
		.where(eq(playlistPricing.id, input.id))
		.returning();

	if (!updated) {
		throw new CommercePricingWindowNotFoundError();
	}

	return toPlaylistPricingWindowView({ row: updated });
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

async function getOrCreateCartId(
	db: DbClient,
	userId: string
): Promise<string> {
	const existing = await db.query.cart.findFirst({
		where: eq(cart.userId, userId),
		columns: { id: true },
	});
	if (existing) {
		return existing.id;
	}

	const [created] = await db.insert(cart).values({ userId }).returning();
	if (!created) {
		throw new Error("Failed to create cart");
	}

	return created.id;
}

function listCartItems(db: DbClient, userId: string) {
	return db
		.select({
			id: cartItem.id,
			itemType: cartItem.itemType,
			contentId: cartItem.contentId,
			playlistId: cartItem.playlistId,
			price: cartItem.price,
			addedAt: cartItem.addedAt,
		})
		.from(cartItem)
		.innerJoin(cart, eq(cartItem.cartId, cart.id))
		.where(eq(cart.userId, userId))
		.orderBy(desc(cartItem.addedAt), desc(cartItem.id));
}

async function resolveCartItemCurrency(params: {
	db: DbClient;
	itemType: CommerceItemType;
	contentId: string | null;
	playlistId: string | null;
	now?: Date;
}): Promise<string> {
	const { db, itemType, contentId, playlistId, now } = params;
	if (itemType === "CONTENT") {
		const price = await resolveActiveContentPrice({
			db,
			contentId: contentId ?? undefined,
			now,
		});
		return price.currency;
	}
	const price = await resolveActivePlaylistPrice({
		db,
		playlistId: playlistId ?? undefined,
		now,
	});
	return price.currency;
}

async function withCartItemCurrency(
	db: DbClient,
	rows: {
		id: string;
		itemType: CommerceItemType;
		contentId: string | null;
		playlistId: string | null;
		price: string;
		addedAt: Date;
	}[]
) {
	const enriched: {
		id: string;
		itemType: CommerceItemType;
		contentId: string | null;
		playlistId: string | null;
		price: string;
		currency: string;
		addedAt: Date;
	}[] = [];

	for (const row of rows) {
		const currency = await resolveCartItemCurrency({
			db,
			itemType: row.itemType,
			contentId: row.contentId,
			playlistId: row.playlistId,
		});
		enriched.push({ ...row, currency });
	}

	return enriched;
}

function toCartView(
	rows: {
		id: string;
		itemType: "CONTENT" | "PLAYLIST";
		contentId: string | null;
		playlistId: string | null;
		price: string;
		currency: string;
		addedAt: Date;
	}[]
): CommerceCartView {
	const currency = assertSingleCurrency(rows.map((item) => item.currency));

	return {
		items: rows.map((row) => ({
			id: row.id,
			itemType: row.itemType,
			contentId: row.contentId,
			playlistId: row.playlistId,
			price: row.price,
			currency: row.currency,
			addedAt: row.addedAt,
		})),
		totalAmount: computeCartTotal(rows.map((item) => item.price)),
		currency,
	};
}

async function assertCartItemNotDuplicate(params: {
	db: DbClient;
	cartId: string;
	itemType: CommerceItemType;
	contentId?: string;
	playlistId?: string;
}) {
	const { db, cartId, itemType, contentId, playlistId } = params;
	let exists: { id: string } | undefined;
	if (itemType === "CONTENT") {
		if (!contentId) {
			throw new CommerceInvalidCartItemError("contentId is required");
		}
		exists = await db.query.cartItem.findFirst({
			where: and(
				eq(cartItem.cartId, cartId),
				eq(cartItem.contentId, contentId)
			),
			columns: { id: true },
		});
	} else {
		if (!playlistId) {
			throw new CommerceInvalidCartItemError("playlistId is required");
		}
		exists = await db.query.cartItem.findFirst({
			where: and(
				eq(cartItem.cartId, cartId),
				eq(cartItem.playlistId, playlistId)
			),
			columns: { id: true },
		});
	}

	if (exists) {
		throw new CommerceDuplicateCartItemError();
	}
}

async function expandOrderItemGrants(params: {
	db: DbClient;
	items: (typeof orderItem.$inferSelect)[];
}) {
	const { db, items } = params;
	const grants: {
		contentId: string;
		playlistId: string | null;
		price: string;
	}[] = [];
	for (const item of items) {
		if (item.itemType === "CONTENT") {
			if (!item.contentId) {
				continue;
			}
			grants.push({
				contentId: item.contentId,
				playlistId: null,
				price: item.price,
			});
			continue;
		}

		if (!item.playlistId) {
			continue;
		}
		const contentIds = await listPlaylistEpisodeContentIds(db, item.playlistId);
		for (const contentId of contentIds) {
			grants.push({
				contentId,
				playlistId: item.playlistId,
				price: item.price,
			});
		}
	}

	const deduped = new Map<string, (typeof grants)[number]>();
	for (const grant of grants) {
		if (!deduped.has(grant.contentId)) {
			deduped.set(grant.contentId, grant);
		}
	}
	return Array.from(deduped.values());
}

function finalizePaidOrder(params: {
	db: DbClient;
	userId: string;
	orderId: string;
	providerTransactionId: string;
	provider: string;
}): Promise<CommercePaymentSuccessView> {
	const { db, userId, orderId, providerTransactionId, provider } = params;
	const now = new Date();

	return db.transaction(async (tx) => {
		const targetOrder = await tx.query.order.findFirst({
			where: and(eq(order.id, orderId), eq(order.userId, userId)),
		});
		if (!targetOrder) {
			throw new CommerceOrderNotFoundError();
		}
		if (targetOrder.status === "FAILED" || targetOrder.status === "REFUNDED") {
			throw new CommerceOrderStateError(
				"Order cannot be marked as paid from current state"
			);
		}

		const existingPayment = await tx.query.payment.findFirst({
			where: and(
				eq(payment.provider, provider),
				eq(payment.providerTransactionId, providerTransactionId)
			),
		});
		if (existingPayment && existingPayment.orderId !== targetOrder.id) {
			throw new CommercePaymentConflictError();
		}

		const existingSuccessPayment = await tx.query.payment.findFirst({
			where: and(
				eq(payment.orderId, targetOrder.id),
				eq(payment.status, "SUCCESS")
			),
		});
		if (targetOrder.status === "PAID" && existingSuccessPayment) {
			const grantRows = await tx
				.select({ id: userLibrary.id })
				.from(userLibrary)
				.where(
					and(
						eq(userLibrary.userId, userId),
						eq(userLibrary.orderId, targetOrder.id)
					)
				);
			return {
				orderId: targetOrder.id,
				paymentId: existingSuccessPayment.id,
				status: "PAID",
				grantsCreated: grantRows.length,
			};
		}

		const [savedPayment] = existingPayment
			? await tx
					.update(payment)
					.set({
						orderId: targetOrder.id,
						status: "SUCCESS",
						amount: targetOrder.totalAmount,
						currency: targetOrder.currency,
						paidAt: now,
						failureReason: null,
					})
					.where(eq(payment.id, existingPayment.id))
					.returning()
			: await tx
					.insert(payment)
					.values({
						orderId: targetOrder.id,
						provider,
						providerTransactionId,
						amount: targetOrder.totalAmount,
						currency: targetOrder.currency,
						status: "SUCCESS",
						paidAt: now,
					})
					.returning();

		if (!savedPayment) {
			throw new Error("Failed to persist payment");
		}

		await tx
			.update(order)
			.set({
				status: "PAID",
				updatedAt: now,
			})
			.where(eq(order.id, targetOrder.id));

		const orderItems = await tx.query.orderItem.findMany({
			where: eq(orderItem.orderId, targetOrder.id),
		});
		const expandedGrants = await expandOrderItemGrants({
			db: tx,
			items: orderItems,
		});
		const owned = await listOwnedContentIds({
			db: tx,
			userId,
			contentIds: expandedGrants.map((item) => item.contentId),
			now,
		});
		const grantsToInsert = expandedGrants.filter(
			(grant) => !owned.has(grant.contentId)
		);

		if (grantsToInsert.length > 0) {
			await tx
				.insert(userLibrary)
				.values(
					grantsToInsert.map((grant) => ({
						userId,
						contentId: grant.contentId,
						playlistId: grant.playlistId,
						orderId: targetOrder.id,
						acquiredAt: now,
					}))
				)
				.onConflictDoNothing({
					target: [userLibrary.userId, userLibrary.contentId],
				});

			await tx
				.insert(contentPurchase)
				.values(
					grantsToInsert.map((grant) => ({
						userId,
						contentId: grant.contentId,
						price: grant.price,
						status: "PAID",
						orderId: targetOrder.id,
						purchasedAt: now,
					}))
				)
				.onConflictDoNothing({
					target: [contentPurchase.userId, contentPurchase.contentId],
				});
		}

		return {
			orderId: targetOrder.id,
			paymentId: savedPayment.id,
			status: "PAID",
			grantsCreated: grantsToInsert.length,
		};
	});
}

export async function listCart(params: {
	db: DbClient;
	userId: string;
}): Promise<CommerceCartView> {
	const rows = await listCartItems(params.db, params.userId);
	const enrichedRows = await withCartItemCurrency(params.db, rows);
	return toCartView(enrichedRows);
}

export async function listCartForCheckout(params: {
	db: DbClient;
	userId: string;
}): Promise<
	{
		id: string;
		itemType: CommerceItemType;
		contentId: string | null;
		playlistId: string | null;
		price: string;
		currency: string;
		addedAt: Date;
	}[]
> {
	const rows = await listCartItems(params.db, params.userId);
	return withCartItemCurrency(params.db, rows);
}

export async function addCartItem(params: {
	db: DbClient;
	userId: string;
	input: CommerceCartAddItemInput;
}): Promise<CommerceCartView> {
	const { db, userId, input } = params;
	const validated = validateCartAddItemInput(input);
	const contentId = validated.contentId;
	const playlistId = validated.playlistId;
	if (validated.itemType === "CONTENT") {
		if (!contentId) {
			throw new CommerceInvalidCartItemError("contentId is required");
		}
		await assertContentExists(db, contentId);
	} else {
		if (!playlistId) {
			throw new CommerceInvalidCartItemError("playlistId is required");
		}
		await assertPlaylistExists(db, playlistId);
	}
	await assertNotAlreadyOwned({
		db,
		userId,
		itemType: validated.itemType,
		contentId,
		playlistId,
	});

	const price = await resolveActivePrice({
		db,
		itemType: validated.itemType,
		contentId,
		playlistId,
	});
	const cartId = await getOrCreateCartId(db, userId);
	await assertCartItemNotDuplicate({
		db,
		cartId,
		itemType: validated.itemType,
		contentId,
		playlistId,
	});

	await db.insert(cartItem).values({
		cartId,
		itemType: validated.itemType,
		contentId: contentId ?? null,
		playlistId: playlistId ?? null,
		price: price.price,
	});

	return listCart({ db, userId });
}

export async function removeCartItem(params: {
	db: DbClient;
	userId: string;
	input: CommerceCartRemoveItemInput;
}): Promise<CommerceCartView> {
	const { db, userId, input } = params;
	const userCart = await db.query.cart.findFirst({
		where: eq(cart.userId, userId),
		columns: { id: true },
	});
	if (!userCart) {
		return {
			items: [],
			totalAmount: "0.00",
			currency: null,
		};
	}

	await db
		.delete(cartItem)
		.where(
			and(eq(cartItem.cartId, userCart.id), eq(cartItem.id, input.cartItemId))
		);

	return listCart({ db, userId });
}

export async function createCheckoutOrder(params: {
	db: DbClient;
	userId: string;
	input: CommerceCheckoutCreateOrderInput;
}): Promise<CommerceCheckoutOrderView> {
	const { db, userId, input } = params;
	if ((input.source ?? "CART") !== "CART") {
		throw new CommerceInvalidCartItemError("Unsupported checkout source");
	}

	const userCart = await db.query.cart.findFirst({
		where: eq(cart.userId, userId),
		columns: { id: true },
	});
	if (!userCart) {
		throw new CommerceInvalidCartItemError("Cart is empty");
	}

	const items = await listCartForCheckout({ db, userId });
	if (items.length === 0) {
		throw new CommerceInvalidCartItemError("Cart is empty");
	}

	const currencies = items.map((item) => item.currency);
	const currency = assertSingleCurrency(currencies);
	if (!currency) {
		throw new CommerceCurrencyMismatchError();
	}
	const totalAmount = computeCartTotal(items.map((item) => item.price));

	return db.transaction(async (tx) => {
		const [createdOrder] = await tx
			.insert(order)
			.values({
				userId,
				totalAmount,
				currency,
				status: "PENDING",
			})
			.returning();
		if (!createdOrder) {
			throw new Error("Failed to create order");
		}

		await tx.insert(orderItem).values(
			items.map((item) => ({
				orderId: createdOrder.id,
				itemType: item.itemType,
				contentId: item.contentId,
				playlistId: item.playlistId,
				price: item.price,
			}))
		);

		await tx.delete(cartItem).where(eq(cartItem.cartId, userCart.id));

		return {
			orderId: createdOrder.id,
			status: createdOrder.status,
			totalAmount: createdOrder.totalAmount,
			currency: createdOrder.currency,
			items: items.map((item) => ({
				itemType: item.itemType,
				contentId: item.contentId,
				playlistId: item.playlistId,
				price: item.price,
				currency: item.currency,
			})),
		};
	});
}

export function markPaymentSuccess(params: {
	db: DbClient;
	userId: string;
	input: CommercePaymentMarkSuccessInput;
}): Promise<CommercePaymentSuccessView> {
	const { db, userId, input } = params;
	return finalizePaidOrder({
		db,
		userId,
		orderId: input.orderId,
		provider: input.provider ?? "mock",
		providerTransactionId: input.providerTransactionId,
	});
}

export function confirmPaymentWebhook(params: {
	db: DbClient;
	userId: string;
	input: CommercePaymentMarkSuccessInput;
}): Promise<CommercePaymentSuccessView> {
	return markPaymentSuccess(params);
}

export function refundPayment(params: {
	db: DbClient;
	userId: string;
	input: CommercePaymentRefundInput;
}): Promise<CommerceRefundView> {
	const { db, userId, input } = params;

	return db.transaction(async (tx) => {
		const targetOrder = await tx.query.order.findFirst({
			where: and(eq(order.id, input.orderId), eq(order.userId, userId)),
		});
		if (!targetOrder) {
			throw new CommerceOrderNotFoundError();
		}

		await tx
			.update(order)
			.set({
				status: "REFUNDED",
				updatedAt: new Date(),
			})
			.where(eq(order.id, targetOrder.id));

		await tx
			.update(contentPurchase)
			.set({
				status: "REFUNDED",
			})
			.where(eq(contentPurchase.orderId, targetOrder.id));

		const revoked = await tx
			.delete(userLibrary)
			.where(
				and(
					eq(userLibrary.userId, userId),
					eq(userLibrary.orderId, targetOrder.id)
				)
			)
			.returning();

		return {
			orderId: targetOrder.id,
			status: "REFUNDED",
			revokedCount: revoked.length,
		};
	});
}

async function findExistingPurchasePayment(params: {
	db: DbClient;
	userId: string;
	contentIds: string[];
}): Promise<{ orderId: string; paymentId: string } | null> {
	const { db, userId, contentIds } = params;
	if (contentIds.length === 0) {
		return null;
	}

	const ownedRow = await db
		.select({
			orderId: userLibrary.orderId,
		})
		.from(userLibrary)
		.where(
			and(
				eq(userLibrary.userId, userId),
				inArray(userLibrary.contentId, contentIds)
			)
		)
		.orderBy(desc(userLibrary.acquiredAt))
		.limit(1);

	const orderId = ownedRow[0]?.orderId;
	if (!orderId) {
		return null;
	}

	const paymentRow = await db.query.payment.findFirst({
		where: and(eq(payment.orderId, orderId), eq(payment.status, "SUCCESS")),
		orderBy: [desc(payment.paidAt), desc(payment.id)],
		columns: {
			id: true,
		},
	});

	if (!paymentRow) {
		return null;
	}

	return {
		orderId,
		paymentId: paymentRow.id,
	};
}

async function createDirectOrder(params: {
	db: DbClient;
	userId: string;
	itemType: CommerceItemType;
	contentId?: string;
	playlistId?: string;
}): Promise<{ orderId: string; currency: string; price: string }> {
	const { db, userId, itemType, contentId, playlistId } = params;
	const price = await resolveActivePrice({
		db,
		itemType,
		contentId,
		playlistId,
	});

	const [createdOrder] = await db
		.insert(order)
		.values({
			userId,
			totalAmount: price.price,
			currency: price.currency,
			status: "PENDING",
		})
		.returning();
	if (!createdOrder) {
		throw new Error("Failed to create direct order");
	}

	await db.insert(orderItem).values({
		orderId: createdOrder.id,
		itemType,
		contentId: contentId ?? null,
		playlistId: playlistId ?? null,
		price: price.price,
	});

	return {
		orderId: createdOrder.id,
		currency: createdOrder.currency,
		price: createdOrder.totalAmount,
	};
}

export async function buyContent(params: {
	db: DbClient;
	userId: string;
	input: CommerceBuyContentInput;
}): Promise<CommerceBuyView> {
	const { db, userId, input } = params;
	await assertContentExists(db, input.contentId);

	const isOwned = await hasActiveContentOwnership({
		db,
		userId,
		contentId: input.contentId,
	});
	if (isOwned) {
		const existing = await findExistingPurchasePayment({
			db,
			userId,
			contentIds: [input.contentId],
		});
		if (!existing) {
			throw new CommerceOrderStateError(
				"Owned content has no successful payment"
			);
		}
		return {
			orderId: existing.orderId,
			paymentId: existing.paymentId,
			status: "PAID",
			alreadyOwned: true,
			grantedContentCount: 0,
		};
	}

	const created = await createDirectOrder({
		db,
		userId,
		itemType: "CONTENT",
		contentId: input.contentId,
	});
	const finalized = await markPaymentSuccess({
		db,
		userId,
		input: {
			orderId: created.orderId,
			provider: "mock",
			providerTransactionId: buildProviderTransactionId(
				input.providerTransactionId
			),
		},
	});

	return {
		orderId: finalized.orderId,
		paymentId: finalized.paymentId,
		status: "PAID",
		alreadyOwned: false,
		grantedContentCount: finalized.grantsCreated,
	};
}

export async function buyPlaylist(params: {
	db: DbClient;
	userId: string;
	input: CommerceBuyPlaylistInput;
}): Promise<CommerceBuyView> {
	const { db, userId, input } = params;
	await assertPlaylistExists(db, input.playlistId);
	const contentIds = await listPlaylistEpisodeContentIds(db, input.playlistId);
	if (contentIds.length === 0) {
		throw new CommercePlaylistEmptyError();
	}

	const isFullyOwned = await hasFullPlaylistOwnership({
		db,
		userId,
		playlistId: input.playlistId,
	});
	if (isFullyOwned) {
		const existing = await findExistingPurchasePayment({
			db,
			userId,
			contentIds,
		});
		if (!existing) {
			throw new CommerceOrderStateError(
				"Owned playlist has no successful payment"
			);
		}
		return {
			orderId: existing.orderId,
			paymentId: existing.paymentId,
			status: "PAID",
			alreadyOwned: true,
			grantedContentCount: 0,
		};
	}

	const created = await createDirectOrder({
		db,
		userId,
		itemType: "PLAYLIST",
		playlistId: input.playlistId,
	});
	const finalized = await markPaymentSuccess({
		db,
		userId,
		input: {
			orderId: created.orderId,
			provider: "mock",
			providerTransactionId: buildProviderTransactionId(
				input.providerTransactionId
			),
		},
	});

	return {
		orderId: finalized.orderId,
		paymentId: finalized.paymentId,
		status: "PAID",
		alreadyOwned: false,
		grantedContentCount: finalized.grantsCreated,
	};
}
