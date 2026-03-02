import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestUser } from "@/__tests__/helpers/factories";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "@/__tests__/helpers/test-db";
import { eq } from "@/lib/db/orm";
import { content, playlist, watchProgress } from "@/lib/db/schema";
import {
	getWatchProgressResume,
	listContinueWatching,
	markWatchProgressCompleted,
	saveWatchProgress,
} from "@/modules/watch-progress/watch-progress.service";
import {
	WatchProgressContentNotFoundError,
	WatchProgressPlaylistNotFoundError,
} from "@/modules/watch-progress/watch-progress.types";

describe("watch-progress service", () => {
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

	it("saveWatchProgress inserts new row", async () => {
		const user = await createTestUser(testDb.client, {
			email: "watch-progress-insert@example.com",
		});

		const [movie] = await testDb.db
			.insert(content)
			.values({
				title: "Movie A",
				contentType: "MOVIE",
				updatedBy: user.id,
				isPublished: true,
				isAvailable: true,
			})
			.returning();

		if (!movie) {
			throw new Error("Failed to create content fixture");
		}

		const saved = await saveWatchProgress({
			db: testDb.db,
			input: {
				userId: user.id,
				contentId: movie.id,
				lastPosition: 120,
				duration: 600,
			},
		});

		expect(saved.progress.contentId).toBe(movie.id);
		expect(saved.progress.lastPosition).toBe(120);
		expect(saved.progress.duration).toBe(600);
		expect(saved.progress.isCompleted).toBe(false);
		expect(saved.progressPercent).toBe(20);
	});

	it("saveWatchProgress updates existing row and clamps position", async () => {
		const user = await createTestUser(testDb.client, {
			email: "watch-progress-update@example.com",
		});

		const [movie] = await testDb.db
			.insert(content)
			.values({
				title: "Movie B",
				contentType: "MOVIE",
				updatedBy: user.id,
				isPublished: true,
				isAvailable: true,
			})
			.returning();

		if (!movie) {
			throw new Error("Failed to create content fixture");
		}

		await saveWatchProgress({
			db: testDb.db,
			input: {
				userId: user.id,
				contentId: movie.id,
				lastPosition: 100,
				duration: 1000,
			},
		});

		const saved = await saveWatchProgress({
			db: testDb.db,
			input: {
				userId: user.id,
				contentId: movie.id,
				lastPosition: 9999,
				duration: 1000,
			},
		});

		expect(saved.progress.lastPosition).toBe(1000);
		expect(saved.progress.duration).toBe(1000);
		expect(saved.progressPercent).toBe(100);

		const rows = await testDb.db
			.select()
			.from(watchProgress)
			.where(eq(watchProgress.contentId, movie.id));
		expect(rows).toHaveLength(1);
	});

	it("saveWatchProgress auto completes at 95% threshold", async () => {
		const user = await createTestUser(testDb.client, {
			email: "watch-progress-threshold@example.com",
		});
		const [movie] = await testDb.db
			.insert(content)
			.values({
				title: "Movie Threshold",
				contentType: "MOVIE",
				updatedBy: user.id,
				isPublished: true,
				isAvailable: true,
			})
			.returning();

		if (!movie) {
			throw new Error("Failed to create content fixture");
		}

		const saved = await saveWatchProgress({
			db: testDb.db,
			input: {
				userId: user.id,
				contentId: movie.id,
				lastPosition: 95,
				duration: 100,
			},
		});

		expect(saved.progress.isCompleted).toBe(true);
		expect(saved.progressPercent).toBe(95);
	});

	it("saveWatchProgress throws for missing content", async () => {
		const user = await createTestUser(testDb.client, {
			email: "watch-progress-no-content@example.com",
		});

		await expect(
			saveWatchProgress({
				db: testDb.db,
				input: {
					userId: user.id,
					contentId: "00000000-0000-0000-0000-000000000000",
					lastPosition: 1,
					duration: 10,
				},
			})
		).rejects.toThrow(WatchProgressContentNotFoundError);
	});

	it("saveWatchProgress throws for missing playlist", async () => {
		const user = await createTestUser(testDb.client, {
			email: "watch-progress-no-playlist@example.com",
		});
		const [movie] = await testDb.db
			.insert(content)
			.values({
				title: "Movie C",
				contentType: "MOVIE",
				updatedBy: user.id,
				isPublished: true,
				isAvailable: true,
			})
			.returning();

		if (!movie) {
			throw new Error("Failed to create content fixture");
		}

		await expect(
			saveWatchProgress({
				db: testDb.db,
				input: {
					userId: user.id,
					contentId: movie.id,
					playlistId: "00000000-0000-0000-0000-000000000000",
					lastPosition: 10,
					duration: 100,
				},
			})
		).rejects.toThrow(WatchProgressPlaylistNotFoundError);
	});

	it("markWatchProgressCompleted creates and updates", async () => {
		const user = await createTestUser(testDb.client, {
			email: "watch-progress-complete@example.com",
		});
		const [movie] = await testDb.db
			.insert(content)
			.values({
				title: "Movie D",
				contentType: "MOVIE",
				updatedBy: user.id,
				isPublished: true,
				isAvailable: true,
			})
			.returning();
		const [series] = await testDb.db
			.insert(playlist)
			.values({
				creatorId: user.id,
				title: "Series 1",
			})
			.returning();

		if (!(movie && series)) {
			throw new Error("Failed to create fixtures");
		}

		const completed = await markWatchProgressCompleted({
			db: testDb.db,
			input: {
				userId: user.id,
				contentId: movie.id,
				playlistId: series.id,
				duration: 400,
			},
		});

		expect(completed.progress.isCompleted).toBe(true);
		expect(completed.progress.lastPosition).toBe(400);
		expect(completed.progressPercent).toBe(100);

		const updated = await markWatchProgressCompleted({
			db: testDb.db,
			input: {
				userId: user.id,
				contentId: movie.id,
			},
		});
		expect(updated.progress.duration).toBe(400);
		expect(updated.progress.lastPosition).toBe(400);
	});

	it("getWatchProgressResume returns null when no progress", async () => {
		const user = await createTestUser(testDb.client, {
			email: "watch-progress-resume-none@example.com",
		});
		const [movie] = await testDb.db
			.insert(content)
			.values({
				title: "Movie E",
				contentType: "MOVIE",
				updatedBy: user.id,
				isPublished: true,
				isAvailable: true,
			})
			.returning();

		if (!movie) {
			throw new Error("Failed to create content fixture");
		}

		const resume = await getWatchProgressResume({
			db: testDb.db,
			input: {
				userId: user.id,
				contentId: movie.id,
			},
		});

		expect(resume).toBeNull();
	});

	it("getWatchProgressResume returns progress details", async () => {
		const user = await createTestUser(testDb.client, {
			email: "watch-progress-resume-some@example.com",
		});
		const [movie] = await testDb.db
			.insert(content)
			.values({
				title: "Movie F",
				contentType: "MOVIE",
				updatedBy: user.id,
				isPublished: true,
				isAvailable: true,
			})
			.returning();

		if (!movie) {
			throw new Error("Failed to create content fixture");
		}

		await saveWatchProgress({
			db: testDb.db,
			input: {
				userId: user.id,
				contentId: movie.id,
				lastPosition: 300,
				duration: 1000,
			},
		});

		const resume = await getWatchProgressResume({
			db: testDb.db,
			input: {
				userId: user.id,
				contentId: movie.id,
			},
		});

		expect(resume).not.toBeNull();
		expect(resume?.resumePosition).toBe(300);
		expect(resume?.progressPercent).toBe(30);
	});

	it("listContinueWatching excludes completed and hidden content with pagination", async () => {
		const user = await createTestUser(testDb.client, {
			email: "watch-progress-continue@example.com",
		});

		const [visibleA] = await testDb.db
			.insert(content)
			.values({
				title: "Visible A",
				contentType: "MOVIE",
				updatedBy: user.id,
				isPublished: true,
				isAvailable: true,
			})
			.returning();
		const [visibleB] = await testDb.db
			.insert(content)
			.values({
				title: "Visible B",
				contentType: "MOVIE",
				updatedBy: user.id,
				isPublished: true,
				isAvailable: true,
			})
			.returning();
		const [hidden] = await testDb.db
			.insert(content)
			.values({
				title: "Hidden",
				contentType: "MOVIE",
				updatedBy: user.id,
				isPublished: false,
				isAvailable: true,
			})
			.returning();

		if (!(visibleA && visibleB && hidden)) {
			throw new Error("Failed to create content fixtures");
		}

		await saveWatchProgress({
			db: testDb.db,
			input: {
				userId: user.id,
				contentId: visibleA.id,
				lastPosition: 10,
				duration: 100,
			},
		});
		await saveWatchProgress({
			db: testDb.db,
			input: {
				userId: user.id,
				contentId: visibleB.id,
				lastPosition: 20,
				duration: 100,
			},
		});
		await saveWatchProgress({
			db: testDb.db,
			input: {
				userId: user.id,
				contentId: hidden.id,
				lastPosition: 30,
				duration: 100,
			},
		});
		await markWatchProgressCompleted({
			db: testDb.db,
			input: {
				userId: user.id,
				contentId: visibleA.id,
				duration: 100,
			},
		});

		const result = await listContinueWatching({
			db: testDb.db,
			input: {
				userId: user.id,
				page: 1,
				limit: 10,
			},
		});

		expect(result.items).toHaveLength(1);
		expect(result.items[0]?.content.id).toBe(visibleB.id);
		expect(result.items[0]?.progressPercent).toBe(20);
		expect(result.pagination).toEqual({
			page: 1,
			limit: 10,
			total: 1,
			totalPages: 1,
		});
	});
});
