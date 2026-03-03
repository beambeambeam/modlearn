import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestUser } from "@/__tests__/helpers/factories";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "@/__tests__/helpers/test-db";
import {
	category,
	content,
	contentCategory,
	watchProgress,
} from "@/lib/db/schema";
import {
	createCaller,
	makeAuthenticatedContext,
	makeTestContext,
} from "@/orpc/__tests__/helpers";

describe("recommendation router", () => {
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

	it("rejects unauthenticated access", async () => {
		const caller = createCaller(makeTestContext({ db: testDb.db }));

		await expect(caller.recommendation.listForMe({})).rejects.toThrow(
			expect.objectContaining({ code: "UNAUTHORIZED" })
		);
		await expect(caller.recommendation.listPopular({})).rejects.toThrow(
			expect.objectContaining({ code: "UNAUTHORIZED" })
		);
		await expect(caller.recommendation.listRecentlyAdded({})).rejects.toThrow(
			expect.objectContaining({ code: "UNAUTHORIZED" })
		);
	});

	it("rejects invalid input", async () => {
		const user = await createTestUser(testDb.client, {
			email: "recommendation-router-invalid@example.com",
		});
		const caller = createCaller(
			makeAuthenticatedContext(user.id, "user", { db: testDb.db })
		);

		await expect(caller.recommendation.listForMe({ limit: 0 })).rejects.toThrow(
			expect.objectContaining({ code: "BAD_REQUEST" })
		);
		await expect(
			caller.recommendation.listForMe({ limit: 51 })
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
		await expect(
			caller.recommendation.listPopular({ limit: 0 })
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
		await expect(
			caller.recommendation.listPopular({ limit: 51 })
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
		await expect(
			caller.recommendation.listRecentlyAdded({ limit: 0 })
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
		await expect(
			caller.recommendation.listRecentlyAdded({ limit: 51 })
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
	});

	it("returns personalized recommendations and respects limit", async () => {
		const user = await createTestUser(testDb.client, {
			email: "recommendation-router-happy@example.com",
		});
		const [catA, catB] = await testDb.db
			.insert(category)
			.values([
				{ title: "Router A", slug: "router-a" },
				{ title: "Router B", slug: "router-b" },
			])
			.returning();

		if (!(catA && catB)) {
			throw new Error("Failed to create category fixtures");
		}

		const [watched, affinityOne, affinityTwo, nonMatch] = await testDb.db
			.insert(content)
			.values([
				{
					title: "Watched",
					contentType: "MOVIE",
					updatedBy: user.id,
					isPublished: true,
					isAvailable: true,
				},
				{
					title: "Affinity One",
					contentType: "MOVIE",
					updatedBy: user.id,
					isPublished: true,
					isAvailable: true,
				},
				{
					title: "Affinity Two",
					contentType: "MOVIE",
					updatedBy: user.id,
					isPublished: true,
					isAvailable: true,
				},
				{
					title: "Non Match",
					contentType: "MOVIE",
					updatedBy: user.id,
					isPublished: true,
					isAvailable: true,
					viewCount: 9999,
				},
			])
			.returning();

		if (!(watched && affinityOne && affinityTwo && nonMatch)) {
			throw new Error("Failed to create recommendation fixtures");
		}

		await testDb.db.insert(contentCategory).values([
			{ contentId: watched.id, categoryId: catA.id },
			{ contentId: affinityOne.id, categoryId: catA.id },
			{ contentId: affinityTwo.id, categoryId: catA.id },
			{ contentId: nonMatch.id, categoryId: catB.id },
		]);

		await testDb.db.insert(watchProgress).values({
			userId: user.id,
			contentId: watched.id,
			lastPosition: 5,
			duration: 100,
		});

		const caller = createCaller(
			makeAuthenticatedContext(user.id, "user", { db: testDb.db })
		);
		const result = await caller.recommendation.listForMe({
			limit: 2,
		});

		expect(result).toHaveLength(2);
		expect(result.some((row) => row.id === watched.id)).toBe(false);
	});

	it("returns popular recommendations ordered by view count and respects limit", async () => {
		const user = await createTestUser(testDb.client, {
			email: "recommendation-router-popular@example.com",
		});

		const [low, high] = await testDb.db
			.insert(content)
			.values([
				{
					title: "Low Popularity",
					contentType: "MOVIE",
					updatedBy: user.id,
					isPublished: true,
					isAvailable: true,
					viewCount: 10,
				},
				{
					title: "High Popularity",
					contentType: "MOVIE",
					updatedBy: user.id,
					isPublished: true,
					isAvailable: true,
					viewCount: 20,
				},
			])
			.returning();

		if (!(low && high)) {
			throw new Error("Failed to create popular fixtures");
		}

		const caller = createCaller(
			makeAuthenticatedContext(user.id, "user", { db: testDb.db })
		);
		const result = await caller.recommendation.listPopular({ limit: 1 });

		expect(result).toHaveLength(1);
		expect(result[0]?.id).toBe(high.id);
	});

	it("returns recently added recommendations ordered by createdAt and respects limit", async () => {
		const user = await createTestUser(testDb.client, {
			email: "recommendation-router-recent@example.com",
		});

		const [older, newer] = await testDb.db
			.insert(content)
			.values([
				{
					title: "Older",
					contentType: "MOVIE",
					updatedBy: user.id,
					isPublished: true,
					isAvailable: true,
					createdAt: new Date("2025-01-01T00:00:00.000Z"),
					updatedAt: new Date("2025-01-01T00:00:00.000Z"),
				},
				{
					title: "Newer",
					contentType: "MOVIE",
					updatedBy: user.id,
					isPublished: true,
					isAvailable: true,
					createdAt: new Date("2025-01-02T00:00:00.000Z"),
					updatedAt: new Date("2025-01-02T00:00:00.000Z"),
				},
			])
			.returning();

		if (!(older && newer)) {
			throw new Error("Failed to create recent fixtures");
		}

		const caller = createCaller(
			makeAuthenticatedContext(user.id, "user", { db: testDb.db })
		);
		const result = await caller.recommendation.listRecentlyAdded({ limit: 1 });

		expect(result).toHaveLength(1);
		expect(result[0]?.id).toBe(newer.id);
	});

	it("filters unpublished, unavailable, and deleted entries in section feeds", async () => {
		const user = await createTestUser(testDb.client, {
			email: "recommendation-router-visibility@example.com",
		});

		const [visible, unpublished, unavailable, deleted] = await testDb.db
			.insert(content)
			.values([
				{
					title: "Visible",
					contentType: "MOVIE",
					updatedBy: user.id,
					isPublished: true,
					isAvailable: true,
					viewCount: 1,
				},
				{
					title: "Unpublished",
					contentType: "MOVIE",
					updatedBy: user.id,
					isPublished: false,
					isAvailable: true,
					viewCount: 999,
				},
				{
					title: "Unavailable",
					contentType: "MOVIE",
					updatedBy: user.id,
					isPublished: true,
					isAvailable: false,
					viewCount: 998,
				},
				{
					title: "Deleted",
					contentType: "MOVIE",
					updatedBy: user.id,
					isPublished: true,
					isAvailable: true,
					isDeleted: true,
					deletedAt: new Date("2025-01-01T00:00:00.000Z"),
					viewCount: 997,
				},
			])
			.returning();

		if (!(visible && unpublished && unavailable && deleted)) {
			throw new Error("Failed to create visibility fixtures");
		}

		const caller = createCaller(
			makeAuthenticatedContext(user.id, "user", { db: testDb.db })
		);
		const popular = await caller.recommendation.listPopular({ limit: 10 });
		const recent = await caller.recommendation.listRecentlyAdded({ limit: 10 });

		expect(popular.map((row) => row.id)).toEqual([visible.id]);
		expect(recent.map((row) => row.id)).toEqual([visible.id]);
	});
});
