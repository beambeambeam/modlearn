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
	createCaller,
	makeAuthenticatedContext,
	makeTestContext,
} from "@/orpc/__tests__/helpers";

async function createOrderForUser(
	testDb: TestDatabase,
	userId: string,
	totalAmount = "19.99"
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

describe("library router", () => {
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

	it("rejects unauthenticated requests", async () => {
		const caller = createCaller(makeTestContext({ db: testDb.db }));

		await expect(caller.library.listMyItems({})).rejects.toThrow(
			expect.objectContaining({ code: "UNAUTHORIZED" })
		);
		await expect(
			caller.library.getPlaylistCollection({
				playlistId: "00000000-0000-0000-0000-000000000000",
			})
		).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
		await expect(
			caller.library.hasAccess({
				contentId: "00000000-0000-0000-0000-000000000000",
			})
		).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
	});

	it("rejects invalid input", async () => {
		const user = await createTestUser(testDb.client, {
			email: "library-router-invalid@example.com",
		});
		const caller = createCaller(
			makeAuthenticatedContext(user.id, "user", { db: testDb.db })
		);

		await expect(caller.library.listMyItems({ page: 0 })).rejects.toThrow(
			expect.objectContaining({ code: "BAD_REQUEST" })
		);

		await expect(
			caller.library.getPlaylistCollection({
				playlistId: "bad-id",
			})
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));

		await expect(
			caller.library.hasAccess({
				contentId: "00000000-0000-0000-0000-000000000000",
				playlistId: "00000000-0000-0000-0000-000000000000",
			})
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
	});

	it("maps domain errors to NOT_FOUND and FORBIDDEN", async () => {
		const user = await createTestUser(testDb.client, {
			email: "library-router-errors@example.com",
		});
		const caller = createCaller(
			makeAuthenticatedContext(user.id, "user", { db: testDb.db })
		);

		await expect(
			caller.library.getPlaylistCollection({
				playlistId: "00000000-0000-0000-0000-000000000000",
			})
		).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));

		const [series] = await testDb.db
			.insert(playlist)
			.values({
				creatorId: user.id,
				title: "Forbidden Series",
			})
			.returning();
		if (!series) {
			throw new Error("Failed to create playlist fixture");
		}

		await expect(
			caller.library.getPlaylistCollection({
				playlistId: series.id,
			})
		).rejects.toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
	});

	it("supports authenticated happy path", async () => {
		const user = await createTestUser(testDb.client, {
			email: "library-router-happy@example.com",
		});
		const userOrder = await createOrderForUser(testDb, user.id);

		const [movie, episode] = await testDb.db
			.insert(content)
			.values([
				{ title: "Router Movie", contentType: "MOVIE", updatedBy: user.id },
				{ title: "Router Episode", contentType: "EPISODE", updatedBy: user.id },
			])
			.returning();
		const [series] = await testDb.db
			.insert(playlist)
			.values({
				creatorId: user.id,
				title: "Router Series",
			})
			.returning();

		if (!(movie && episode && series)) {
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

		const caller = createCaller(
			makeAuthenticatedContext(user.id, "user", { db: testDb.db })
		);

		const listed = await caller.library.listMyItems({});
		expect(listed.pagination.total).toBe(2);
		expect(listed.items).toHaveLength(2);

		const collection = await caller.library.getPlaylistCollection({
			playlistId: series.id,
		});
		expect(collection.type).toBe("PLAYLIST_COLLECTION");
		expect(collection.playlist.id).toBe(series.id);
		expect(collection.episodes).toHaveLength(1);

		await expect(
			caller.library.hasAccess({ contentId: movie.id })
		).resolves.toEqual({ hasAccess: true });

		await expect(
			caller.library.hasAccess({ playlistId: series.id })
		).resolves.toEqual({ hasAccess: true });
	});
});
