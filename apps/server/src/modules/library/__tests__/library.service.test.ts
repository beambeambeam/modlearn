import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestUser } from "@/__tests__/helpers/factories";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "@/__tests__/helpers/test-db";
import {
	content,
	order,
	playlist,
	playlistEpisode,
	userLibrary,
} from "@/lib/db/schema";
import {
	getMyPlaylistCollection,
	hasLibraryAccess,
	listMyLibraryItems,
} from "@/modules/library/library.service";
import {
	LibraryAccessDeniedError,
	LibraryPlaylistNotFoundError,
} from "@/modules/library/library.types";

async function createOrderForUser(
	testDb: TestDatabase,
	userId: string,
	totalAmount = "29.99"
) {
	const [created] = await testDb.db
		.insert(order)
		.values({
			userId,
			totalAmount,
			currency: "USD",
			itemType: "CONTENT",
			contentId: null,
			playlistId: null,
			status: "PAID",
		})
		.returning();

	if (!created) {
		throw new Error("Failed to create order fixture");
	}

	return created;
}

describe("library service", () => {
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

	it("listMyLibraryItems returns standalone content and grouped playlist collection", async () => {
		const user = await createTestUser(testDb.client, {
			email: "library-list@example.com",
		});
		const userOrder = await createOrderForUser(testDb, user.id);

		const [movie, ep2, ep1] = await testDb.db
			.insert(content)
			.values([
				{
					title: "My Movie",
					contentType: "MOVIE",
					updatedBy: user.id,
				},
				{
					title: "Episode 2",
					contentType: "EPISODE",
					updatedBy: user.id,
				},
				{
					title: "Episode 1",
					contentType: "EPISODE",
					updatedBy: user.id,
				},
			])
			.returning();

		if (!(movie && ep1 && ep2)) {
			throw new Error("Failed to create content fixtures");
		}

		const [series] = await testDb.db
			.insert(playlist)
			.values({
				creatorId: user.id,
				title: "Purchased Series",
			})
			.returning();

		if (!series) {
			throw new Error("Failed to create playlist fixture");
		}

		await testDb.db.insert(playlistEpisode).values([
			{
				playlistId: series.id,
				contentId: ep2.id,
				episodeOrder: 2,
				seasonNumber: 1,
			},
			{
				playlistId: series.id,
				contentId: ep1.id,
				episodeOrder: 1,
				seasonNumber: 1,
			},
		]);

		await testDb.db.insert(userLibrary).values([
			{
				userId: user.id,
				contentId: movie.id,
				orderId: userOrder.id,
				acquiredAt: new Date("2026-01-01T00:00:00.000Z"),
			},
			{
				userId: user.id,
				contentId: ep1.id,
				playlistId: series.id,
				orderId: userOrder.id,
				acquiredAt: new Date("2026-01-02T00:00:00.000Z"),
			},
			{
				userId: user.id,
				contentId: ep2.id,
				playlistId: series.id,
				orderId: userOrder.id,
				acquiredAt: new Date("2026-01-02T00:00:00.000Z"),
			},
		]);

		const result = await listMyLibraryItems({
			db: testDb.db,
			userId: user.id,
			input: { page: 1, limit: 20 },
		});

		expect(result.pagination.total).toBe(2);
		expect(result.items).toHaveLength(2);
		expect(result.items[0]?.type).toBe("PLAYLIST_COLLECTION");
		expect(result.items[1]?.type).toBe("CONTENT");

		const playlistItem = result.items.find(
			(item) => item.type === "PLAYLIST_COLLECTION"
		);
		if (!playlistItem || playlistItem.type !== "PLAYLIST_COLLECTION") {
			throw new Error("Expected playlist item");
		}
		expect(playlistItem.playlist.id).toBe(series.id);
		expect(playlistItem.episodes).toHaveLength(2);
		expect(playlistItem.episodes.map((episode) => episode.content.id)).toEqual([
			ep1.id,
			ep2.id,
		]);
	});

	it("getMyPlaylistCollection throws not found and access denied correctly", async () => {
		const user = await createTestUser(testDb.client, {
			email: "library-collection-errors@example.com",
		});

		await expect(
			getMyPlaylistCollection({
				db: testDb.db,
				userId: user.id,
				input: { playlistId: "00000000-0000-0000-0000-000000000000" },
			})
		).rejects.toThrow(LibraryPlaylistNotFoundError);

		const [series] = await testDb.db
			.insert(playlist)
			.values({
				creatorId: user.id,
				title: "No Access Series",
			})
			.returning();

		if (!series) {
			throw new Error("Failed to create playlist fixture");
		}

		await expect(
			getMyPlaylistCollection({
				db: testDb.db,
				userId: user.id,
				input: { playlistId: series.id },
			})
		).rejects.toThrow(LibraryAccessDeniedError);
	});

	it("hasLibraryAccess supports direct content, playlist-derived content, and playlist checks", async () => {
		const user = await createTestUser(testDb.client, {
			email: "library-has-access@example.com",
		});
		const userOrder = await createOrderForUser(testDb, user.id);

		const [movie, episode] = await testDb.db
			.insert(content)
			.values([
				{ title: "Direct Movie", contentType: "MOVIE", updatedBy: user.id },
				{
					title: "Derived Episode",
					contentType: "EPISODE",
					updatedBy: user.id,
				},
			])
			.returning();
		const [series] = await testDb.db
			.insert(playlist)
			.values({
				creatorId: user.id,
				title: "Access Series",
			})
			.returning();

		if (!(movie && episode && series)) {
			throw new Error("Failed to create fixtures");
		}

		await testDb.db.insert(userLibrary).values([
			{
				userId: user.id,
				contentId: movie.id,
				orderId: userOrder.id,
			},
			{
				userId: user.id,
				contentId: episode.id,
				playlistId: series.id,
				orderId: userOrder.id,
			},
		]);

		await expect(
			hasLibraryAccess({
				db: testDb.db,
				userId: user.id,
				input: { contentId: movie.id },
			})
		).resolves.toEqual({ hasAccess: true });

		await expect(
			hasLibraryAccess({
				db: testDb.db,
				userId: user.id,
				input: { contentId: episode.id },
			})
		).resolves.toEqual({ hasAccess: true });

		await expect(
			hasLibraryAccess({
				db: testDb.db,
				userId: user.id,
				input: { playlistId: series.id },
			})
		).resolves.toEqual({ hasAccess: true });

		await expect(
			hasLibraryAccess({
				db: testDb.db,
				userId: user.id,
				input: { contentId: "00000000-0000-0000-0000-000000000000" },
			})
		).resolves.toEqual({ hasAccess: false });
	});

	it("expired entitlements are excluded from listing and access checks", async () => {
		const user = await createTestUser(testDb.client, {
			email: "library-expired@example.com",
		});
		const userOrder = await createOrderForUser(testDb, user.id);
		const [movie] = await testDb.db
			.insert(content)
			.values({
				title: "Expired Movie",
				contentType: "MOVIE",
				updatedBy: user.id,
			})
			.returning();

		if (!movie) {
			throw new Error("Failed to create content fixture");
		}

		await testDb.db.insert(userLibrary).values({
			userId: user.id,
			contentId: movie.id,
			orderId: userOrder.id,
			expiresAt: new Date("2024-01-01T00:00:00.000Z"),
		});

		const listed = await listMyLibraryItems({
			db: testDb.db,
			userId: user.id,
			input: { page: 1, limit: 20 },
		});
		expect(listed.items).toHaveLength(0);

		await expect(
			hasLibraryAccess({
				db: testDb.db,
				userId: user.id,
				input: { contentId: movie.id },
			})
		).resolves.toEqual({ hasAccess: false });
	});

	it("listMyLibraryItems paginates mixed library items", async () => {
		const user = await createTestUser(testDb.client, {
			email: "library-pagination@example.com",
		});
		const userOrder = await createOrderForUser(testDb, user.id);

		const [movieA, movieB, episode] = await testDb.db
			.insert(content)
			.values([
				{ title: "Movie A", contentType: "MOVIE", updatedBy: user.id },
				{ title: "Movie B", contentType: "MOVIE", updatedBy: user.id },
				{ title: "Episode", contentType: "EPISODE", updatedBy: user.id },
			])
			.returning();
		const [series] = await testDb.db
			.insert(playlist)
			.values({
				creatorId: user.id,
				title: "Paged Series",
			})
			.returning();
		if (!(movieA && movieB && episode && series)) {
			throw new Error("Failed to create fixtures");
		}

		await testDb.db.insert(playlistEpisode).values({
			playlistId: series.id,
			contentId: episode.id,
			episodeOrder: 1,
		});

		await testDb.db.insert(userLibrary).values([
			{
				userId: user.id,
				contentId: movieA.id,
				orderId: userOrder.id,
				acquiredAt: new Date("2026-01-01T00:00:00.000Z"),
			},
			{
				userId: user.id,
				contentId: movieB.id,
				orderId: userOrder.id,
				acquiredAt: new Date("2026-01-02T00:00:00.000Z"),
			},
			{
				userId: user.id,
				contentId: episode.id,
				playlistId: series.id,
				orderId: userOrder.id,
				acquiredAt: new Date("2026-01-03T00:00:00.000Z"),
			},
		]);

		const page2 = await listMyLibraryItems({
			db: testDb.db,
			userId: user.id,
			input: { page: 2, limit: 1 },
		});

		expect(page2.pagination).toEqual({
			page: 2,
			limit: 1,
			total: 3,
			totalPages: 3,
		});
		expect(page2.items).toHaveLength(1);
	});
});
