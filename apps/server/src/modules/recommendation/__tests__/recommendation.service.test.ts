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
	listPopularRecommendations,
	listRecentlyAddedRecommendations,
	listRecommendationsForUser,
} from "@/modules/recommendation/recommendation.service";

describe("recommendation service", () => {
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

	it("ranks category affinity above non-matching high popularity", async () => {
		const user = await createTestUser(testDb.client, {
			email: "recommendation-affinity@example.com",
		});

		const [catA, catB] = await testDb.db
			.insert(category)
			.values([
				{ title: "Affinity A", slug: "affinity-a" },
				{ title: "Affinity B", slug: "affinity-b" },
			])
			.returning();

		if (!(catA && catB)) {
			throw new Error("Failed to create category fixtures");
		}

		const [watched, affinityCandidate, popularCandidate] = await testDb.db
			.insert(content)
			.values([
				{
					title: "Watched A",
					contentType: "MOVIE",
					updatedBy: user.id,
					isPublished: true,
					isAvailable: true,
					viewCount: 5,
				},
				{
					title: "Affinity Candidate",
					contentType: "MOVIE",
					updatedBy: user.id,
					isPublished: true,
					isAvailable: true,
					viewCount: 1,
				},
				{
					title: "Popular Candidate",
					contentType: "MOVIE",
					updatedBy: user.id,
					isPublished: true,
					isAvailable: true,
					viewCount: 100_000,
				},
			])
			.returning();

		if (!(watched && affinityCandidate && popularCandidate)) {
			throw new Error("Failed to create content fixtures");
		}

		await testDb.db.insert(contentCategory).values([
			{ contentId: watched.id, categoryId: catA.id },
			{ contentId: affinityCandidate.id, categoryId: catA.id },
			{ contentId: popularCandidate.id, categoryId: catB.id },
		]);

		await testDb.db.insert(watchProgress).values({
			userId: user.id,
			contentId: watched.id,
			lastPosition: 100,
			duration: 1000,
		});

		const result = await listRecommendationsForUser({
			db: testDb.db,
			input: {
				userId: user.id,
				limit: 2,
			},
		});

		expect(result.map((row) => row.id)).toEqual([
			affinityCandidate.id,
			popularCandidate.id,
		]);
		expect(result.some((row) => row.id === watched.id)).toBe(false);
	});

	it("excludes unpublished, unavailable, and deleted content", async () => {
		const user = await createTestUser(testDb.client, {
			email: "recommendation-visibility@example.com",
		});
		const [cat] = await testDb.db
			.insert(category)
			.values([{ title: "Visibility", slug: "visibility" }])
			.returning();

		if (!cat) {
			throw new Error("Failed to create category fixture");
		}

		const [watched, published, unpublished, unavailable, deleted] =
			await testDb.db
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
						title: "Published",
						contentType: "MOVIE",
						updatedBy: user.id,
						isPublished: true,
						isAvailable: true,
					},
					{
						title: "Unpublished",
						contentType: "MOVIE",
						updatedBy: user.id,
						isPublished: false,
						isAvailable: true,
					},
					{
						title: "Unavailable",
						contentType: "MOVIE",
						updatedBy: user.id,
						isPublished: true,
						isAvailable: false,
					},
					{
						title: "Deleted",
						contentType: "MOVIE",
						updatedBy: user.id,
						isPublished: true,
						isAvailable: true,
						isDeleted: true,
						deletedAt: new Date("2025-01-01T00:00:00.000Z"),
					},
				])
				.returning();

		if (!(watched && published && unpublished && unavailable && deleted)) {
			throw new Error("Failed to create visibility fixtures");
		}

		await testDb.db.insert(contentCategory).values([
			{ contentId: watched.id, categoryId: cat.id },
			{ contentId: published.id, categoryId: cat.id },
			{ contentId: unpublished.id, categoryId: cat.id },
			{ contentId: unavailable.id, categoryId: cat.id },
			{ contentId: deleted.id, categoryId: cat.id },
		]);

		await testDb.db.insert(watchProgress).values({
			userId: user.id,
			contentId: watched.id,
			lastPosition: 10,
			duration: 100,
		});

		const result = await listRecommendationsForUser({
			db: testDb.db,
			input: { userId: user.id },
		});

		expect(result).toHaveLength(1);
		expect(result[0]?.id).toBe(published.id);
	});

	it("falls back to global popular when user has no watch history", async () => {
		const user = await createTestUser(testDb.client, {
			email: "recommendation-no-history@example.com",
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
			throw new Error("Failed to create fallback fixtures");
		}

		const result = await listRecommendationsForUser({
			db: testDb.db,
			input: {
				userId: user.id,
				limit: 2,
			},
		});

		expect(result.map((row) => row.id)).toEqual([high.id, low.id]);
	});

	it("falls back to popular and still excludes watched when affinity cannot match", async () => {
		const user = await createTestUser(testDb.client, {
			email: "recommendation-sparse-fallback@example.com",
		});
		const [catA, catB] = await testDb.db
			.insert(category)
			.values([
				{ title: "Sparse A", slug: "sparse-a" },
				{ title: "Sparse B", slug: "sparse-b" },
			])
			.returning();

		if (!(catA && catB)) {
			throw new Error("Failed to create sparse categories");
		}

		const [watched, nonMatching] = await testDb.db
			.insert(content)
			.values([
				{
					title: "Watched Sparse",
					contentType: "MOVIE",
					updatedBy: user.id,
					isPublished: true,
					isAvailable: true,
					viewCount: 400,
				},
				{
					title: "Popular Non-Match",
					contentType: "MOVIE",
					updatedBy: user.id,
					isPublished: true,
					isAvailable: true,
					viewCount: 300,
				},
			])
			.returning();

		if (!(watched && nonMatching)) {
			throw new Error("Failed to create sparse content");
		}

		await testDb.db.insert(contentCategory).values([
			{ contentId: watched.id, categoryId: catA.id },
			{ contentId: nonMatching.id, categoryId: catB.id },
		]);
		await testDb.db.insert(watchProgress).values({
			userId: user.id,
			contentId: watched.id,
			lastPosition: 50,
			duration: 100,
		});

		const result = await listRecommendationsForUser({
			db: testDb.db,
			input: {
				userId: user.id,
				limit: 2,
			},
		});

		expect(result.map((row) => row.id)).toEqual([nonMatching.id]);
		expect(result.some((row) => row.id === watched.id)).toBe(false);
	});

	it("honors limit and deterministic tie-breakers", async () => {
		const user = await createTestUser(testDb.client, {
			email: "recommendation-ordering@example.com",
		});
		const [cat] = await testDb.db
			.insert(category)
			.values([{ title: "Ordering", slug: "ordering" }])
			.returning();

		if (!cat) {
			throw new Error("Failed to create ordering category");
		}

		const [watched, older, newer] = await testDb.db
			.insert(content)
			.values([
				{
					title: "Watched Ordering",
					contentType: "MOVIE",
					updatedBy: user.id,
					isPublished: true,
					isAvailable: true,
					viewCount: 5,
				},
				{
					title: "Older Candidate",
					contentType: "MOVIE",
					updatedBy: user.id,
					isPublished: true,
					isAvailable: true,
					viewCount: 10,
					createdAt: new Date("2025-01-01T00:00:00.000Z"),
					updatedAt: new Date("2025-01-01T00:00:00.000Z"),
				},
				{
					title: "Newer Candidate",
					contentType: "MOVIE",
					updatedBy: user.id,
					isPublished: true,
					isAvailable: true,
					viewCount: 10,
					createdAt: new Date("2025-01-02T00:00:00.000Z"),
					updatedAt: new Date("2025-01-02T00:00:00.000Z"),
				},
			])
			.returning();

		if (!(watched && older && newer)) {
			throw new Error("Failed to create ordering content");
		}

		await testDb.db.insert(contentCategory).values([
			{ contentId: watched.id, categoryId: cat.id },
			{ contentId: older.id, categoryId: cat.id },
			{ contentId: newer.id, categoryId: cat.id },
		]);
		await testDb.db.insert(watchProgress).values({
			userId: user.id,
			contentId: watched.id,
			lastPosition: 1,
			duration: 10,
		});

		const result = await listRecommendationsForUser({
			db: testDb.db,
			input: {
				userId: user.id,
				limit: 1,
			},
		});

		expect(result).toHaveLength(1);
		expect(result[0]?.id).toBe(newer.id);
	});

	it("lists popular recommendations by view count and applies visibility filters", async () => {
		const user = await createTestUser(testDb.client, {
			email: "recommendation-popular-feed@example.com",
		});

		const [low, high, unpublished, unavailable, deleted] = await testDb.db
			.insert(content)
			.values([
				{
					title: "Low",
					contentType: "MOVIE",
					updatedBy: user.id,
					isPublished: true,
					isAvailable: true,
					viewCount: 5,
				},
				{
					title: "High",
					contentType: "MOVIE",
					updatedBy: user.id,
					isPublished: true,
					isAvailable: true,
					viewCount: 10,
				},
				{
					title: "Unpublished",
					contentType: "MOVIE",
					updatedBy: user.id,
					isPublished: false,
					isAvailable: true,
					viewCount: 5000,
				},
				{
					title: "Unavailable",
					contentType: "MOVIE",
					updatedBy: user.id,
					isPublished: true,
					isAvailable: false,
					viewCount: 4000,
				},
				{
					title: "Deleted",
					contentType: "MOVIE",
					updatedBy: user.id,
					isPublished: true,
					isAvailable: true,
					isDeleted: true,
					deletedAt: new Date("2025-01-01T00:00:00.000Z"),
					viewCount: 3000,
				},
			])
			.returning();

		if (!(low && high && unpublished && unavailable && deleted)) {
			throw new Error("Failed to create popular section fixtures");
		}

		const result = await listPopularRecommendations({
			db: testDb.db,
			input: { limit: 2 },
		});

		expect(result.map((row) => row.id)).toEqual([high.id, low.id]);
	});

	it("lists recently added recommendations by createdAt and applies visibility filters", async () => {
		const user = await createTestUser(testDb.client, {
			email: "recommendation-recent-feed@example.com",
		});

		const [older, newer, unpublished, unavailable, deleted] = await testDb.db
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
				{
					title: "Unpublished",
					contentType: "MOVIE",
					updatedBy: user.id,
					isPublished: false,
					isAvailable: true,
					createdAt: new Date("2025-01-03T00:00:00.000Z"),
					updatedAt: new Date("2025-01-03T00:00:00.000Z"),
				},
				{
					title: "Unavailable",
					contentType: "MOVIE",
					updatedBy: user.id,
					isPublished: true,
					isAvailable: false,
					createdAt: new Date("2025-01-04T00:00:00.000Z"),
					updatedAt: new Date("2025-01-04T00:00:00.000Z"),
				},
				{
					title: "Deleted",
					contentType: "MOVIE",
					updatedBy: user.id,
					isPublished: true,
					isAvailable: true,
					isDeleted: true,
					deletedAt: new Date("2025-01-05T00:00:00.000Z"),
					createdAt: new Date("2025-01-05T00:00:00.000Z"),
					updatedAt: new Date("2025-01-05T00:00:00.000Z"),
				},
			])
			.returning();

		if (!(older && newer && unpublished && unavailable && deleted)) {
			throw new Error("Failed to create recently added section fixtures");
		}

		const result = await listRecentlyAddedRecommendations({
			db: testDb.db,
			input: { limit: 2 },
		});

		expect(result.map((row) => row.id)).toEqual([newer.id, older.id]);
	});
});
