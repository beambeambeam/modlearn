import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestUser } from "@/__tests__/helpers/factories";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "@/__tests__/helpers/test-db";
import {
	content,
	contentPricing,
	order,
	orderItem,
	payment,
	playlist,
	playlistEpisode,
	playlistPricing,
	userLibrary,
} from "@/lib/db/schema";
import {
	addCartItem,
	assertNotAlreadyOwned,
	assertSingleCurrency,
	computeCartTotal,
	createCheckoutOrder,
	hasFullPlaylistOwnership,
	listCart,
	markPaymentSuccess,
	refundPayment,
	removeCartItem,
	resolveActiveContentPrice,
	resolveActivePlaylistPrice,
	validateCartAddItemInput,
} from "@/modules/commerce/commerce.service";
import {
	CommerceCurrencyMismatchError,
	CommerceDuplicateCartItemError,
	CommerceInvalidCartItemError,
	CommerceItemAlreadyOwnedError,
	CommercePriceNotFoundError,
} from "@/modules/commerce/commerce.types";

async function createPaidOrderFixture(testDb: TestDatabase, userId: string) {
	const [created] = await testDb.db
		.insert(order)
		.values({
			userId,
			totalAmount: "10.00",
			currency: "USD",
			status: "PAID",
		})
		.returning();

	if (!created) {
		throw new Error("Failed to create order fixture");
	}

	return created;
}

async function createContentWithPricing(params: {
	testDb: TestDatabase;
	adminId: string;
	title: string;
	price: string;
	currency?: string;
}) {
	const { testDb, adminId, title, price, currency = "USD" } = params;
	const [createdContent] = await testDb.db
		.insert(content)
		.values({
			title,
			contentType: "MOVIE",
			updatedBy: adminId,
		})
		.returning();

	if (!createdContent) {
		throw new Error("Failed to create content");
	}

	await testDb.db.insert(contentPricing).values({
		contentId: createdContent.id,
		price,
		currency,
		effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
		createdBy: adminId,
	});

	return createdContent;
}

async function createPlaylistWithPricing(params: {
	testDb: TestDatabase;
	adminId: string;
	title: string;
	price: string;
	episodeContentIds: string[];
	currency?: string;
}) {
	const {
		testDb,
		adminId,
		title,
		price,
		episodeContentIds,
		currency = "USD",
	} = params;
	const [createdPlaylist] = await testDb.db
		.insert(playlist)
		.values({
			creatorId: adminId,
			title,
		})
		.returning();

	if (!createdPlaylist) {
		throw new Error("Failed to create playlist");
	}

	await testDb.db.insert(playlistPricing).values({
		playlistId: createdPlaylist.id,
		price,
		currency,
		effectiveFrom: new Date("2026-01-01"),
		createdBy: adminId,
	});

	await testDb.db.insert(playlistEpisode).values(
		episodeContentIds.map((contentId, index) => ({
			playlistId: createdPlaylist.id,
			contentId,
			episodeOrder: index + 1,
			seasonNumber: 1,
		}))
	);

	return createdPlaylist;
}

describe("commerce service", () => {
	let testDb: TestDatabase;

	beforeAll(async () => {
		testDb = await createTestDatabase();
	});

	beforeEach(async () => {
		await resetTestDatabase(testDb.client);
	});

	afterAll(async () => {
		await testDb.cleanup();
	});

	it("computes cart totals and validates single currency", () => {
		expect(computeCartTotal(["10.20", "9.80"])).toBe("20.00");
		expect(assertSingleCurrency(["usd", "USD"]))?.toBe("USD");
		expect(assertSingleCurrency([])).toBeNull();
		expect(() => assertSingleCurrency(["USD", "THB"])).toThrow(
			CommerceCurrencyMismatchError
		);
	});

	it("validates cart item payload", () => {
		expect(
			validateCartAddItemInput({
				itemType: "CONTENT",
				contentId: "00000000-0000-0000-0000-000000000001",
			})
		).toEqual({
			itemType: "CONTENT",
			contentId: "00000000-0000-0000-0000-000000000001",
		});

		expect(() =>
			validateCartAddItemInput({
				itemType: "CONTENT",
				playlistId: "00000000-0000-0000-0000-000000000001",
			})
		).toThrow(CommerceInvalidCartItemError);
	});

	it("resolves active content and playlist prices using effective windows", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "commerce-foundation-admin@example.com",
		});

		const movie = await createContentWithPricing({
			testDb,
			adminId: admin.id,
			title: "Movie",
			price: "11.00",
		});
		await testDb.db.insert(contentPricing).values({
			contentId: movie.id,
			price: "12.50",
			currency: "USD",
			effectiveFrom: new Date("2026-02-01T00:00:00.000Z"),
			createdBy: admin.id,
		});

		const episode = await createContentWithPricing({
			testDb,
			adminId: admin.id,
			title: "Episode",
			price: "5.00",
		});
		const series = await createPlaylistWithPricing({
			testDb,
			adminId: admin.id,
			title: "Series",
			price: "39.00",
			episodeContentIds: [episode.id],
			currency: "usd",
		});
		await testDb.db.insert(playlistPricing).values({
			playlistId: series.id,
			price: "42.00",
			currency: "USD",
			effectiveFrom: new Date("2026-02-01"),
			createdBy: admin.id,
		});

		await expect(
			resolveActiveContentPrice({
				db: testDb.db,
				contentId: movie.id,
				now: new Date("2026-02-10T12:00:00.000Z"),
			})
		).resolves.toMatchObject({
			itemType: "CONTENT",
			price: "12.50",
			currency: "USD",
		});

		await expect(
			resolveActivePlaylistPrice({
				db: testDb.db,
				playlistId: series.id,
				now: new Date("2026-02-10T12:00:00.000Z"),
			})
		).resolves.toMatchObject({
			itemType: "PLAYLIST",
			price: "42.00",
			currency: "USD",
		});

		await expect(
			resolveActiveContentPrice({
				db: testDb.db,
				contentId: movie.id,
				now: new Date("2025-01-01T00:00:00.000Z"),
			})
		).rejects.toThrow(CommercePriceNotFoundError);
	});

	it("detects fully-owned playlists and blocks already-owned items", async () => {
		const user = await createTestUser(testDb.client, {
			email: "commerce-owned-user@example.com",
		});
		const ep1 = await createContentWithPricing({
			testDb,
			adminId: user.id,
			title: "Episode 1",
			price: "4.00",
		});
		const ep2 = await createContentWithPricing({
			testDb,
			adminId: user.id,
			title: "Episode 2",
			price: "6.00",
		});
		const series = await createPlaylistWithPricing({
			testDb,
			adminId: user.id,
			title: "Owned Series",
			price: "8.00",
			episodeContentIds: [ep1.id, ep2.id],
		});
		const paidOrder = await createPaidOrderFixture(testDb, user.id);

		await testDb.db.insert(userLibrary).values([
			{
				userId: user.id,
				contentId: ep1.id,
				playlistId: series.id,
				orderId: paidOrder.id,
			},
			{
				userId: user.id,
				contentId: ep2.id,
				playlistId: series.id,
				orderId: paidOrder.id,
			},
		]);

		await expect(
			hasFullPlaylistOwnership({
				db: testDb.db,
				userId: user.id,
				playlistId: series.id,
			})
		).resolves.toBe(true);

		await expect(
			assertNotAlreadyOwned({
				db: testDb.db,
				userId: user.id,
				itemType: "PLAYLIST",
				playlistId: series.id,
			})
		).rejects.toThrow(CommerceItemAlreadyOwnedError);
	});

	it("supports cart add/list/remove and duplicate prevention", async () => {
		const user = await createTestUser(testDb.client, {
			email: "commerce-cart-user@example.com",
		});
		const movie = await createContentWithPricing({
			testDb,
			adminId: user.id,
			title: "Cart Movie",
			price: "9.99",
		});

		const added = await addCartItem({
			db: testDb.db,
			userId: user.id,
			input: { itemType: "CONTENT", contentId: movie.id },
		});
		expect(added.items).toHaveLength(1);

		await expect(
			addCartItem({
				db: testDb.db,
				userId: user.id,
				input: { itemType: "CONTENT", contentId: movie.id },
			})
		).rejects.toThrow(CommerceDuplicateCartItemError);

		const listed = await listCart({ db: testDb.db, userId: user.id });
		expect(listed.totalAmount).toBe("9.99");

		const cartItemId = listed.items[0]?.id;
		if (!cartItemId) {
			throw new Error("Expected cart item id");
		}

		const removed = await removeCartItem({
			db: testDb.db,
			userId: user.id,
			input: { cartItemId },
		});
		expect(removed.items).toHaveLength(0);
	});

	it("creates checkout order from cart and clears cart", async () => {
		const user = await createTestUser(testDb.client, {
			email: "commerce-checkout-user@example.com",
		});
		const movieA = await createContentWithPricing({
			testDb,
			adminId: user.id,
			title: "Checkout A",
			price: "10.00",
		});
		const movieB = await createContentWithPricing({
			testDb,
			adminId: user.id,
			title: "Checkout B",
			price: "15.50",
		});

		await addCartItem({
			db: testDb.db,
			userId: user.id,
			input: { itemType: "CONTENT", contentId: movieA.id },
		});
		await addCartItem({
			db: testDb.db,
			userId: user.id,
			input: { itemType: "CONTENT", contentId: movieB.id },
		});

		const checkout = await createCheckoutOrder({
			db: testDb.db,
			userId: user.id,
			input: { source: "CART" },
		});

		expect(checkout.status).toBe("PENDING");
		expect(checkout.totalAmount).toBe("25.50");
		expect(checkout.items).toHaveLength(2);

		const orderItems = await testDb.db
			.select()
			.from(orderItem)
			.where(eq(orderItem.orderId, checkout.orderId));
		expect(orderItems).toHaveLength(2);

		const cartView = await listCart({ db: testDb.db, userId: user.id });
		expect(cartView.items).toHaveLength(0);
	});

	it("marks payment success idempotently and grants user library access", async () => {
		const user = await createTestUser(testDb.client, {
			email: "commerce-pay-user@example.com",
		});
		const movie = await createContentWithPricing({
			testDb,
			adminId: user.id,
			title: "Paid Movie",
			price: "20.00",
		});
		const ep1 = await createContentWithPricing({
			testDb,
			adminId: user.id,
			title: "Paid Episode 1",
			price: "4.00",
		});
		const ep2 = await createContentWithPricing({
			testDb,
			adminId: user.id,
			title: "Paid Episode 2",
			price: "5.00",
		});
		const series = await createPlaylistWithPricing({
			testDb,
			adminId: user.id,
			title: "Paid Playlist",
			price: "30.00",
			episodeContentIds: [ep1.id, ep2.id],
		});

		await addCartItem({
			db: testDb.db,
			userId: user.id,
			input: { itemType: "CONTENT", contentId: movie.id },
		});
		await addCartItem({
			db: testDb.db,
			userId: user.id,
			input: { itemType: "PLAYLIST", playlistId: series.id },
		});

		const checkout = await createCheckoutOrder({
			db: testDb.db,
			userId: user.id,
			input: { source: "CART" },
		});

		const paid = await markPaymentSuccess({
			db: testDb.db,
			userId: user.id,
			input: {
				orderId: checkout.orderId,
				provider: "mock",
				providerTransactionId: "txn-001",
			},
		});
		expect(paid.status).toBe("PAID");
		expect(paid.grantsCreated).toBe(3);

		const paidAgain = await markPaymentSuccess({
			db: testDb.db,
			userId: user.id,
			input: {
				orderId: checkout.orderId,
				provider: "mock",
				providerTransactionId: "txn-001",
			},
		});
		expect(paidAgain.paymentId).toBe(paid.paymentId);
		expect(paidAgain.grantsCreated).toBe(3);

		const orderRows = await testDb.db
			.select()
			.from(order)
			.where(eq(order.id, checkout.orderId));
		expect(orderRows[0]?.status).toBe("PAID");

		const paymentRows = await testDb.db
			.select()
			.from(payment)
			.where(eq(payment.orderId, checkout.orderId));
		expect(paymentRows).toHaveLength(1);
		expect(paymentRows[0]?.status).toBe("SUCCESS");

		const libraryRows = await testDb.db
			.select()
			.from(userLibrary)
			.where(eq(userLibrary.orderId, checkout.orderId));
		expect(libraryRows).toHaveLength(3);
	});

	it("refund marks order refunded and revokes library access", async () => {
		const user = await createTestUser(testDb.client, {
			email: "commerce-refund-user@example.com",
		});
		const movie = await createContentWithPricing({
			testDb,
			adminId: user.id,
			title: "Refund Movie",
			price: "12.00",
		});

		await addCartItem({
			db: testDb.db,
			userId: user.id,
			input: { itemType: "CONTENT", contentId: movie.id },
		});
		const checkout = await createCheckoutOrder({
			db: testDb.db,
			userId: user.id,
			input: { source: "CART" },
		});
		await markPaymentSuccess({
			db: testDb.db,
			userId: user.id,
			input: {
				orderId: checkout.orderId,
				provider: "mock",
				providerTransactionId: "txn-refund-001",
			},
		});

		const refunded = await refundPayment({
			db: testDb.db,
			userId: user.id,
			input: {
				orderId: checkout.orderId,
				reason: "user requested",
			},
		});
		expect(refunded.status).toBe("REFUNDED");
		expect(refunded.revokedCount).toBe(1);

		const libraryRows = await testDb.db
			.select()
			.from(userLibrary)
			.where(eq(userLibrary.orderId, checkout.orderId));
		expect(libraryRows).toHaveLength(0);

		const orderRows = await testDb.db
			.select()
			.from(order)
			.where(eq(order.id, checkout.orderId));
		expect(orderRows[0]?.status).toBe("REFUNDED");
	});
});
