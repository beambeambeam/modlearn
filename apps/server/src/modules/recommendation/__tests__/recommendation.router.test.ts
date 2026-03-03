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
});
