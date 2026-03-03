import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestUser } from "@/__tests__/helpers/factories";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "@/__tests__/helpers/test-db";
import { eq } from "@/lib/db/orm";
import {
	content,
	playlist,
	playlistContent,
	playlistEpisode,
	watchProgress,
} from "@/lib/db/schema";
import {
	getPlaylistAutoPlayNext,
	getPlaylistWatchProgressResume,
	getWatchProgressResume,
	listContinueWatching,
	markWatchProgressCompleted,
	saveWatchProgress,
} from "@/modules/watch-progress/watch-progress.service";
import {
	WatchProgressContentNotFoundError,
	WatchProgressPlaylistNotFoundError,
	WatchProgressValidationError,
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

	async function seedVisiblePlaylistEpisodes(userId: string) {
		const [series] = await testDb.db
			.insert(playlist)
			.values({
				creatorId: userId,
				title: "Series Seed",
			})
			.returning();
		if (!series) {
			throw new Error("Failed to create playlist fixture");
		}

		const [episodeA] = await testDb.db
			.insert(content)
			.values({
				title: "Episode A",
				contentType: "EPISODE",
				updatedBy: userId,
				isPublished: true,
				isAvailable: true,
				duration: 100,
			})
			.returning();
		const [episodeB] = await testDb.db
			.insert(content)
			.values({
				title: "Episode B",
				contentType: "EPISODE",
				updatedBy: userId,
				isPublished: true,
				isAvailable: true,
				duration: 100,
			})
			.returning();
		const [episodeC] = await testDb.db
			.insert(content)
			.values({
				title: "Episode C",
				contentType: "EPISODE",
				updatedBy: userId,
				isPublished: true,
				isAvailable: true,
				duration: 100,
			})
			.returning();

		if (!(episodeA && episodeB && episodeC)) {
			throw new Error("Failed to create episode fixtures");
		}

		await testDb.db.insert(playlistEpisode).values([
			{
				playlistId: series.id,
				contentId: episodeA.id,
				episodeOrder: 1,
				seasonNumber: 1,
			},
			{
				playlistId: series.id,
				contentId: episodeB.id,
				episodeOrder: 2,
				seasonNumber: 1,
			},
			{
				playlistId: series.id,
				contentId: episodeC.id,
				episodeOrder: 3,
				seasonNumber: 1,
			},
		]);

		return {
			playlist: series,
			episodes: [episodeA, episodeB, episodeC],
		};
	}

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

	it("tracks latest watched episode at playlist level", async () => {
		const user = await createTestUser(testDb.client, {
			email: "watch-progress-latest-marker@example.com",
		});
		const seeded = await seedVisiblePlaylistEpisodes(user.id);
		const [firstEpisode, secondEpisode] = seeded.episodes;
		if (!(firstEpisode && secondEpisode)) {
			throw new Error("Missing seeded episodes");
		}

		await saveWatchProgress({
			db: testDb.db,
			input: {
				userId: user.id,
				playlistId: seeded.playlist.id,
				contentId: firstEpisode.id,
				lastPosition: 25,
				duration: 100,
			},
		});

		await markWatchProgressCompleted({
			db: testDb.db,
			input: {
				userId: user.id,
				playlistId: seeded.playlist.id,
				contentId: secondEpisode.id,
				duration: 100,
			},
		});

		const latestRows = await testDb.db
			.select()
			.from(playlistContent)
			.where(eq(playlistContent.playlistId, seeded.playlist.id));

		expect(latestRows).toHaveLength(2);
		const latest = latestRows.find((row) => row.isLatestWatched);
		expect(latest?.contentId).toBe(secondEpisode.id);
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

	it("getPlaylistWatchProgressResume starts from first episode when no history", async () => {
		const user = await createTestUser(testDb.client, {
			email: "watch-progress-playlist-resume-new@example.com",
		});
		const seeded = await seedVisiblePlaylistEpisodes(user.id);
		const [firstEpisode, secondEpisode] = seeded.episodes;
		if (!(firstEpisode && secondEpisode)) {
			throw new Error("Missing seeded episodes");
		}

		const resume = await getPlaylistWatchProgressResume({
			db: testDb.db,
			input: {
				userId: user.id,
				playlistId: seeded.playlist.id,
			},
		});

		expect(resume?.currentEpisode.contentId).toBe(firstEpisode.id);
		expect(resume?.resumePosition).toBe(0);
		expect(resume?.nextEpisode?.contentId).toBe(secondEpisode.id);
		expect(resume?.isPlaylistCompleted).toBe(false);
		expect(resume?.lastWatchedContentId).toBeNull();
	});

	it("getPlaylistWatchProgressResume resumes same episode when latest is incomplete", async () => {
		const user = await createTestUser(testDb.client, {
			email: "watch-progress-playlist-resume-incomplete@example.com",
		});
		const seeded = await seedVisiblePlaylistEpisodes(user.id);
		const [firstEpisode, secondEpisode] = seeded.episodes;
		if (!(firstEpisode && secondEpisode)) {
			throw new Error("Missing seeded episodes");
		}

		await saveWatchProgress({
			db: testDb.db,
			input: {
				userId: user.id,
				playlistId: seeded.playlist.id,
				contentId: firstEpisode.id,
				lastPosition: 33,
				duration: 100,
			},
		});

		const resume = await getPlaylistWatchProgressResume({
			db: testDb.db,
			input: {
				userId: user.id,
				playlistId: seeded.playlist.id,
			},
		});

		expect(resume?.currentEpisode.contentId).toBe(firstEpisode.id);
		expect(resume?.resumePosition).toBe(33);
		expect(resume?.nextEpisode?.contentId).toBe(secondEpisode.id);
		expect(resume?.isPlaylistCompleted).toBe(false);
		expect(resume?.lastWatchedContentId).toBe(firstEpisode.id);
	});

	it("getPlaylistWatchProgressResume advances when latest episode is completed", async () => {
		const user = await createTestUser(testDb.client, {
			email: "watch-progress-playlist-resume-advance@example.com",
		});
		const seeded = await seedVisiblePlaylistEpisodes(user.id);
		const [firstEpisode, secondEpisode, thirdEpisode] = seeded.episodes;
		if (!(firstEpisode && secondEpisode && thirdEpisode)) {
			throw new Error("Missing seeded episodes");
		}

		await markWatchProgressCompleted({
			db: testDb.db,
			input: {
				userId: user.id,
				playlistId: seeded.playlist.id,
				contentId: firstEpisode.id,
				duration: 100,
			},
		});

		const resume = await getPlaylistWatchProgressResume({
			db: testDb.db,
			input: {
				userId: user.id,
				playlistId: seeded.playlist.id,
			},
		});

		expect(resume?.currentEpisode.contentId).toBe(secondEpisode.id);
		expect(resume?.resumePosition).toBe(0);
		expect(resume?.nextEpisode?.contentId).toBe(thirdEpisode.id);
		expect(resume?.isPlaylistCompleted).toBe(false);
		expect(resume?.lastWatchedContentId).toBe(firstEpisode.id);
	});

	it("getPlaylistWatchProgressResume signals completion at playlist end", async () => {
		const user = await createTestUser(testDb.client, {
			email: "watch-progress-playlist-resume-ended@example.com",
		});
		const seeded = await seedVisiblePlaylistEpisodes(user.id);
		const thirdEpisode = seeded.episodes[2];
		if (!thirdEpisode) {
			throw new Error("Missing seeded episode");
		}

		await markWatchProgressCompleted({
			db: testDb.db,
			input: {
				userId: user.id,
				playlistId: seeded.playlist.id,
				contentId: thirdEpisode.id,
				duration: 100,
			},
		});

		const resume = await getPlaylistWatchProgressResume({
			db: testDb.db,
			input: {
				userId: user.id,
				playlistId: seeded.playlist.id,
			},
		});

		expect(resume?.currentEpisode.contentId).toBe(thirdEpisode.id);
		expect(resume?.resumePosition).toBe(0);
		expect(resume?.nextEpisode).toBeNull();
		expect(resume?.isPlaylistCompleted).toBe(true);
		expect(resume?.lastWatchedContentId).toBe(thirdEpisode.id);
	});

	it("getPlaylistAutoPlayNext returns next and completed states", async () => {
		const user = await createTestUser(testDb.client, {
			email: "watch-progress-playlist-next@example.com",
		});
		const seeded = await seedVisiblePlaylistEpisodes(user.id);
		const [firstEpisode, secondEpisode, thirdEpisode] = seeded.episodes;
		if (!(firstEpisode && secondEpisode && thirdEpisode)) {
			throw new Error("Missing seeded episodes");
		}

		const nextFromFirst = await getPlaylistAutoPlayNext({
			db: testDb.db,
			input: {
				userId: user.id,
				playlistId: seeded.playlist.id,
				contentId: firstEpisode.id,
			},
		});
		expect(nextFromFirst.nextEpisode?.contentId).toBe(secondEpisode.id);
		expect(nextFromFirst.isPlaylistCompleted).toBe(false);

		const nextFromLast = await getPlaylistAutoPlayNext({
			db: testDb.db,
			input: {
				userId: user.id,
				playlistId: seeded.playlist.id,
				contentId: thirdEpisode.id,
			},
		});
		expect(nextFromLast.nextEpisode).toBeNull();
		expect(nextFromLast.isPlaylistCompleted).toBe(true);
	});

	it("getPlaylistAutoPlayNext throws when content is not in playlist", async () => {
		const user = await createTestUser(testDb.client, {
			email: "watch-progress-playlist-next-invalid@example.com",
		});
		const seeded = await seedVisiblePlaylistEpisodes(user.id);
		const [otherEpisode] = await testDb.db
			.insert(content)
			.values({
				title: "Outside Episode",
				contentType: "EPISODE",
				updatedBy: user.id,
				isPublished: true,
				isAvailable: true,
			})
			.returning();

		if (!otherEpisode) {
			throw new Error("Failed to create outside episode fixture");
		}

		await expect(
			getPlaylistAutoPlayNext({
				db: testDb.db,
				input: {
					userId: user.id,
					playlistId: seeded.playlist.id,
					contentId: otherEpisode.id,
				},
			})
		).rejects.toThrow(WatchProgressValidationError);
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
