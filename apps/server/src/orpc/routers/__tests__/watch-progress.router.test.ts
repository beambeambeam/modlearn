import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestUser } from "@/__tests__/helpers/factories";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "@/__tests__/helpers/test-db";
import { content } from "@/lib/db/schema";
import {
	createCaller,
	makeAuthenticatedContext,
	makeTestContext,
} from "@/orpc/__tests__/helpers";

describe("watch-progress router", () => {
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

		await expect(
			caller.watchProgress.save({
				contentId: "00000000-0000-0000-0000-000000000000",
				lastPosition: 1,
				duration: 10,
			})
		).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));

		await expect(
			caller.watchProgress.markCompleted({
				contentId: "00000000-0000-0000-0000-000000000000",
			})
		).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));

		await expect(
			caller.watchProgress.getResume({
				contentId: "00000000-0000-0000-0000-000000000000",
			})
		).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));

		await expect(caller.watchProgress.continueWatching({})).rejects.toThrow(
			expect.objectContaining({ code: "UNAUTHORIZED" })
		);
	});

	it("rejects invalid inputs", async () => {
		const user = await createTestUser(testDb.client, {
			email: "watch-progress-router-invalid@example.com",
		});
		const caller = createCaller(
			makeAuthenticatedContext(user.id, "user", { db: testDb.db })
		);

		await expect(
			caller.watchProgress.save({
				contentId: "bad-id",
				lastPosition: 1,
				duration: 10,
			})
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));

		await expect(
			caller.watchProgress.save({
				contentId: "00000000-0000-0000-0000-000000000000",
				lastPosition: -1,
				duration: 10,
			})
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));

		await expect(
			caller.watchProgress.continueWatching({
				page: 0,
			})
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
	});

	it("maps domain not found to NOT_FOUND", async () => {
		const user = await createTestUser(testDb.client, {
			email: "watch-progress-router-notfound@example.com",
		});
		const caller = createCaller(
			makeAuthenticatedContext(user.id, "user", { db: testDb.db })
		);

		await expect(
			caller.watchProgress.save({
				contentId: "00000000-0000-0000-0000-000000000000",
				lastPosition: 2,
				duration: 10,
			})
		).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
	});

	it("supports authenticated happy path", async () => {
		const user = await createTestUser(testDb.client, {
			email: "watch-progress-router-happy@example.com",
		});
		const [movie] = await testDb.db
			.insert(content)
			.values({
				title: "Router Movie",
				contentType: "MOVIE",
				updatedBy: user.id,
				isPublished: true,
				isAvailable: true,
			})
			.returning();

		if (!movie) {
			throw new Error("Failed to create content fixture");
		}

		const caller = createCaller(
			makeAuthenticatedContext(user.id, "user", { db: testDb.db })
		);

		const saved = await caller.watchProgress.save({
			contentId: movie.id,
			lastPosition: 20,
			duration: 100,
		});
		expect(saved.progress.contentId).toBe(movie.id);
		expect(saved.progressPercent).toBe(20);

		const resume = await caller.watchProgress.getResume({
			contentId: movie.id,
		});
		expect(resume?.resumePosition).toBe(20);

		const completed = await caller.watchProgress.markCompleted({
			contentId: movie.id,
		});
		expect(completed.progress.isCompleted).toBe(true);

		const continueList = await caller.watchProgress.continueWatching({
			page: 1,
			limit: 10,
		});
		expect(continueList.items).toHaveLength(0);
	});
});
