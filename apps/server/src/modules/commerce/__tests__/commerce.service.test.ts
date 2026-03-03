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
	playlist,
	playlistEpisode,
	playlistPricing,
	userLibrary,
} from "@/lib/db/schema";
import {
	assertNotAlreadyOwned,
	assertSingleCurrency,
	computeCartTotal,
	hasFullPlaylistOwnership,
	resolveActiveContentPrice,
	resolveActivePlaylistPrice,
	validateCartAddItemInput,
} from "@/modules/commerce/commerce.service";
import {
	CommerceCurrencyMismatchError,
	CommerceInvalidCartItemError,
	CommerceItemAlreadyOwnedError,
	CommercePriceNotFoundError,
} from "@/modules/commerce/commerce.types";

describe("commerce service foundations", () => {
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

		const [movie] = await testDb.db
			.insert(content)
			.values({
				title: "Movie",
				contentType: "MOVIE",
				updatedBy: admin.id,
			})
			.returning();

		const [series] = await testDb.db
			.insert(playlist)
			.values({
				creatorId: admin.id,
				title: "Series",
			})
			.returning();

		if (!(movie && series)) {
			throw new Error("Failed to create fixtures");
		}

		await testDb.db.insert(contentPricing).values([
			{
				contentId: movie.id,
				price: "11.00",
				currency: "USD",
				effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
				effectiveTo: new Date("2026-01-31T23:59:59.000Z"),
				createdBy: admin.id,
			},
			{
				contentId: movie.id,
				price: "12.50",
				currency: "USD",
				effectiveFrom: new Date("2026-02-01T00:00:00.000Z"),
				createdBy: admin.id,
			},
		]);

		await testDb.db.insert(playlistPricing).values([
			{
				playlistId: series.id,
				price: "39.00",
				currency: "usd",
				effectiveFrom: new Date("2026-01-01"),
				effectiveTo: new Date("2026-01-31"),
				createdBy: admin.id,
			},
			{
				playlistId: series.id,
				price: "42.00",
				currency: "USD",
				effectiveFrom: new Date("2026-02-01"),
				createdBy: admin.id,
			},
		]);

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
		const [ep1, ep2] = await testDb.db
			.insert(content)
			.values([
				{ title: "Episode 1", contentType: "EPISODE", updatedBy: user.id },
				{ title: "Episode 2", contentType: "EPISODE", updatedBy: user.id },
			])
			.returning();
		const [series] = await testDb.db
			.insert(playlist)
			.values({
				creatorId: user.id,
				title: "Owned Series",
			})
			.returning();
		const [paidOrder] = await testDb.db
			.insert(order)
			.values({
				userId: user.id,
				totalAmount: "10.00",
				currency: "USD",
				status: "PAID",
			})
			.returning();

		if (!(ep1 && ep2 && series && paidOrder)) {
			throw new Error("Failed to create fixtures");
		}

		await testDb.db.insert(playlistEpisode).values([
			{ playlistId: series.id, contentId: ep1.id, episodeOrder: 1 },
			{ playlistId: series.id, contentId: ep2.id, episodeOrder: 2 },
		]);

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
});
