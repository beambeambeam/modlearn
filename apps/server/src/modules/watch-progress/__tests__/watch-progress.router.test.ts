import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestUser } from "@/__tests__/helpers/factories";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "@/__tests__/helpers/test-db";
import { content, playlist, playlistEpisode } from "@/lib/db/schema";
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

		await expect(
			caller.watchProgress.getPlaylistResume({
				playlistId: "00000000-0000-0000-0000-000000000000",
			})
		).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));

		await expect(
			caller.watchProgress.getPlaylistAutoPlayNext({
				playlistId: "00000000-0000-0000-0000-000000000000",
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

		await expect(
			caller.watchProgress.getPlaylistResume({
				playlistId: "not-a-uuid",
			})
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));

		await expect(
			caller.watchProgress.getPlaylistAutoPlayNext({
				playlistId: "not-a-uuid",
				contentId: "also-not-a-uuid",
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

		await expect(
			caller.watchProgress.getPlaylistResume({
				playlistId: "00000000-0000-0000-0000-000000000000",
			})
		).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
	});

	it("supports authenticated happy path including playlist progression endpoints", async () => {
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
		const [episodeA] = await testDb.db
			.insert(content)
			.values({
				title: "Router Episode A",
				contentType: "EPISODE",
				updatedBy: user.id,
				isPublished: true,
				isAvailable: true,
				duration: 100,
			})
			.returning();
		const [episodeB] = await testDb.db
			.insert(content)
			.values({
				title: "Router Episode B",
				contentType: "EPISODE",
				updatedBy: user.id,
				isPublished: true,
				isAvailable: true,
				duration: 100,
			})
			.returning();
		const [series] = await testDb.db
			.insert(playlist)
			.values({
				creatorId: user.id,
				title: "Router Playlist",
			})
			.returning();

		if (!(episodeA && episodeB && series)) {
			throw new Error("Failed to create playlist fixtures");
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
		]);

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

		await caller.watchProgress.save({
			contentId: episodeA.id,
			playlistId: series.id,
			lastPosition: 50,
			duration: 100,
		});

		const playlistResume = await caller.watchProgress.getPlaylistResume({
			playlistId: series.id,
		});
		expect(playlistResume?.currentEpisode.contentId).toBe(episodeA.id);
		expect(playlistResume?.resumePosition).toBe(50);

		const playlistNext = await caller.watchProgress.getPlaylistAutoPlayNext({
			playlistId: series.id,
			contentId: episodeA.id,
		});
		expect(playlistNext.nextEpisode?.contentId).toBe(episodeB.id);
		expect(playlistNext.isPlaylistCompleted).toBe(false);
	});

	it("maps playlist auto-play membership errors to BAD_REQUEST", async () => {
		const user = await createTestUser(testDb.client, {
			email: "watch-progress-router-playlist-bad-request@example.com",
		});
		const [episodeInPlaylist] = await testDb.db
			.insert(content)
			.values({
				title: "Episode In Playlist",
				contentType: "EPISODE",
				updatedBy: user.id,
				isPublished: true,
				isAvailable: true,
				duration: 100,
			})
			.returning();
		const [episodeOutside] = await testDb.db
			.insert(content)
			.values({
				title: "Episode Outside Playlist",
				contentType: "EPISODE",
				updatedBy: user.id,
				isPublished: true,
				isAvailable: true,
				duration: 100,
			})
			.returning();
		const [series] = await testDb.db
			.insert(playlist)
			.values({
				creatorId: user.id,
				title: "Playlist Membership Check",
			})
			.returning();

		if (!(episodeInPlaylist && episodeOutside && series)) {
			throw new Error("Failed to create membership fixtures");
		}

		await testDb.db.insert(playlistEpisode).values({
			playlistId: series.id,
			contentId: episodeInPlaylist.id,
			episodeOrder: 1,
			seasonNumber: 1,
		});

		const caller = createCaller(
			makeAuthenticatedContext(user.id, "user", { db: testDb.db })
		);

		await expect(
			caller.watchProgress.getPlaylistAutoPlayNext({
				playlistId: series.id,
				contentId: episodeOutside.id,
			})
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
	});
});
