import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestUser } from "@/__tests__/helpers/factories";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "@/__tests__/helpers/test-db";
import { eq } from "@/lib/db/orm";
import { content, playlist, playlistEpisode } from "@/lib/db/schema";
import {
	addEpisodeToPlaylist,
	createPlaylist,
	getPlaylistByIdWithEpisodes,
	listPlaylistEpisodes,
	reorderPlaylistEpisodes,
} from "@/modules/playlist/playlist.service";
import {
	ContentNotFoundError,
	PlaylistNotFoundError,
	PlaylistReorderValidationError,
} from "@/modules/playlist/playlist.types";

describe("playlist service", () => {
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

	async function createContentRow(
		userId: string,
		input?: Partial<typeof content.$inferInsert>
	): Promise<typeof content.$inferSelect> {
		const [row] = await testDb.db
			.insert(content)
			.values({
				title: input?.title ?? "Episode",
				description: input?.description ?? null,
				contentType: input?.contentType ?? "EPISODE",
				updatedBy: userId,
				isPublished: input?.isPublished ?? true,
				isAvailable: input?.isAvailable ?? true,
				publishedAt: input?.publishedAt ?? new Date("2025-01-01T00:00:00.000Z"),
				duration: input?.duration ?? 1000,
				releaseDate: input?.releaseDate ?? new Date("2025-01-01T00:00:00.000Z"),
				thumbnailImageId: input?.thumbnailImageId ?? null,
				fileId: input?.fileId ?? null,
				viewCount: input?.viewCount ?? 0,
			})
			.returning();

		if (!row) {
			throw new Error("Failed to create content test fixture");
		}

		return row;
	}

	it("getPlaylistByIdWithEpisodes returns ordered visible episodes", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "playlist-get@example.com",
			role: "admin",
		});

		const createdPlaylist = await createPlaylist({
			db: testDb.db,
			input: {
				title: "Series A",
			},
			creatorId: admin.id,
		});

		const visibleA = await createContentRow(admin.id, {
			title: "Visible A",
			isPublished: true,
			isAvailable: true,
		});
		const hidden = await createContentRow(admin.id, {
			title: "Hidden",
			isPublished: false,
			isAvailable: true,
			publishedAt: null,
		});
		const visibleB = await createContentRow(admin.id, {
			title: "Visible B",
			isPublished: true,
			isAvailable: true,
		});

		await testDb.db.insert(playlistEpisode).values([
			{
				playlistId: createdPlaylist.id,
				contentId: hidden.id,
				episodeOrder: 1,
				seasonNumber: 1,
			},
			{
				playlistId: createdPlaylist.id,
				contentId: visibleB.id,
				episodeOrder: 2,
				seasonNumber: 1,
			},
			{
				playlistId: createdPlaylist.id,
				contentId: visibleA.id,
				episodeOrder: 1,
				seasonNumber: 2,
			},
		]);

		const result = await getPlaylistByIdWithEpisodes({
			db: testDb.db,
			input: { id: createdPlaylist.id },
		});

		expect(result.id).toBe(createdPlaylist.id);
		expect(result.episodes).toHaveLength(2);
		expect(result.episodes.map((episode) => episode.content.title)).toEqual([
			"Visible B",
			"Visible A",
		]);
	});

	it("getPlaylistByIdWithEpisodes throws when playlist does not exist", async () => {
		await expect(
			getPlaylistByIdWithEpisodes({
				db: testDb.db,
				input: { id: "00000000-0000-0000-0000-000000000000" },
			})
		).rejects.toThrow(PlaylistNotFoundError);
	});

	it("listPlaylistEpisodes filters by season and keeps order", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "playlist-list@example.com",
		});
		const [createdPlaylist] = await testDb.db
			.insert(playlist)
			.values({
				creatorId: admin.id,
				title: "Series B",
			})
			.returning();
		if (!createdPlaylist) {
			throw new Error("Failed to create playlist fixture");
		}

		const episode1 = await createContentRow(admin.id, { title: "S1E1" });
		const episode2 = await createContentRow(admin.id, { title: "S1E2" });
		const episode3 = await createContentRow(admin.id, { title: "S2E1" });

		await testDb.db.insert(playlistEpisode).values([
			{
				playlistId: createdPlaylist.id,
				contentId: episode2.id,
				episodeOrder: 2,
				seasonNumber: 1,
			},
			{
				playlistId: createdPlaylist.id,
				contentId: episode1.id,
				episodeOrder: 1,
				seasonNumber: 1,
			},
			{
				playlistId: createdPlaylist.id,
				contentId: episode3.id,
				episodeOrder: 1,
				seasonNumber: 2,
			},
		]);

		const seasonOne = await listPlaylistEpisodes({
			db: testDb.db,
			input: {
				playlistId: createdPlaylist.id,
				seasonNumber: 1,
			},
		});
		expect(seasonOne).toHaveLength(2);
		expect(seasonOne.map((episode) => episode.content.title)).toEqual([
			"S1E1",
			"S1E2",
		]);
	});

	it("createPlaylist creates row with creatorId", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "playlist-create@example.com",
		});

		const created = await createPlaylist({
			db: testDb.db,
			input: {
				title: "New Playlist",
			},
			creatorId: admin.id,
		});

		expect(created.title).toBe("New Playlist");
		expect(created.creatorId).toBe(admin.id);
		expect(created.isSeries).toBe(true);
	});

	it("addEpisodeToPlaylist appends when no order is provided", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "playlist-add-append@example.com",
		});
		const [createdPlaylist] = await testDb.db
			.insert(playlist)
			.values({
				creatorId: admin.id,
				title: "Append Playlist",
			})
			.returning();
		if (!createdPlaylist) {
			throw new Error("Failed to create playlist fixture");
		}
		const existingContent = await createContentRow(admin.id, {
			title: "Existing",
		});
		const incomingContent = await createContentRow(admin.id, {
			title: "Incoming",
		});

		await testDb.db.insert(playlistEpisode).values({
			playlistId: createdPlaylist.id,
			contentId: existingContent.id,
			episodeOrder: 1,
			seasonNumber: 1,
		});

		const added = await addEpisodeToPlaylist({
			db: testDb.db,
			input: {
				playlistId: createdPlaylist.id,
				contentId: incomingContent.id,
				seasonNumber: 1,
			},
		});

		expect(added.episodeOrder).toBe(2);
	});

	it("addEpisodeToPlaylist inserts and shifts when order is provided", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "playlist-add-shift@example.com",
		});
		const [createdPlaylist] = await testDb.db
			.insert(playlist)
			.values({
				creatorId: admin.id,
				title: "Shift Playlist",
			})
			.returning();
		if (!createdPlaylist) {
			throw new Error("Failed to create playlist fixture");
		}

		const c1 = await createContentRow(admin.id, { title: "Episode 1" });
		const c2 = await createContentRow(admin.id, { title: "Episode 2" });
		const cIncoming = await createContentRow(admin.id, { title: "Inserted" });

		await testDb.db.insert(playlistEpisode).values([
			{
				playlistId: createdPlaylist.id,
				contentId: c1.id,
				episodeOrder: 1,
				seasonNumber: 1,
			},
			{
				playlistId: createdPlaylist.id,
				contentId: c2.id,
				episodeOrder: 2,
				seasonNumber: 1,
			},
		]);

		const added = await addEpisodeToPlaylist({
			db: testDb.db,
			input: {
				playlistId: createdPlaylist.id,
				contentId: cIncoming.id,
				seasonNumber: 1,
				episodeOrder: 2,
			},
		});
		expect(added.episodeOrder).toBe(2);

		const rows = await testDb.db
			.select()
			.from(playlistEpisode)
			.where(eq(playlistEpisode.playlistId, createdPlaylist.id))
			.orderBy(playlistEpisode.episodeOrder);
		expect(rows.map((row) => row.episodeOrder)).toEqual([1, 2, 3]);
	});

	it("addEpisodeToPlaylist throws for missing playlist/content", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "playlist-add-errors@example.com",
		});
		const contentRow = await createContentRow(admin.id, {
			title: "Only Content",
		});
		const [createdPlaylist] = await testDb.db
			.insert(playlist)
			.values({
				creatorId: admin.id,
				title: "Only Playlist",
			})
			.returning();
		if (!createdPlaylist) {
			throw new Error("Failed to create playlist fixture");
		}

		await expect(
			addEpisodeToPlaylist({
				db: testDb.db,
				input: {
					playlistId: "00000000-0000-0000-0000-000000000000",
					contentId: contentRow.id,
				},
			})
		).rejects.toThrow(PlaylistNotFoundError);

		await expect(
			addEpisodeToPlaylist({
				db: testDb.db,
				input: {
					playlistId: createdPlaylist.id,
					contentId: "00000000-0000-0000-0000-000000000000",
				},
			})
		).rejects.toThrow(ContentNotFoundError);
	});

	it("reorderPlaylistEpisodes rewrites order to 1..N", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "playlist-reorder@example.com",
		});
		const [createdPlaylist] = await testDb.db
			.insert(playlist)
			.values({
				creatorId: admin.id,
				title: "Reorder Playlist",
			})
			.returning();
		if (!createdPlaylist) {
			throw new Error("Failed to create playlist fixture");
		}

		const c1 = await createContentRow(admin.id, { title: "Episode 1" });
		const c2 = await createContentRow(admin.id, { title: "Episode 2" });
		const c3 = await createContentRow(admin.id, { title: "Episode 3" });

		const inserted = await testDb.db
			.insert(playlistEpisode)
			.values([
				{
					playlistId: createdPlaylist.id,
					contentId: c1.id,
					episodeOrder: 1,
					seasonNumber: 1,
				},
				{
					playlistId: createdPlaylist.id,
					contentId: c2.id,
					episodeOrder: 2,
					seasonNumber: 1,
				},
				{
					playlistId: createdPlaylist.id,
					contentId: c3.id,
					episodeOrder: 3,
					seasonNumber: 1,
				},
			])
			.returning();

		const third = inserted[2];
		const first = inserted[0];
		const second = inserted[1];
		if (!(first && second && third)) {
			throw new Error("Failed to create playlist episode fixtures");
		}

		const reordered = await reorderPlaylistEpisodes({
			db: testDb.db,
			input: {
				playlistId: createdPlaylist.id,
				episodeIds: [third.id, first.id, second.id],
			},
		});

		expect(reordered.map((row) => row.id)).toEqual([
			third.id,
			first.id,
			second.id,
		]);
		expect(reordered.map((row) => row.episodeOrder)).toEqual([1, 2, 3]);
	});

	it("reorderPlaylistEpisodes validates exact set and duplicates", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "playlist-reorder-validate@example.com",
		});
		const [createdPlaylist] = await testDb.db
			.insert(playlist)
			.values({
				creatorId: admin.id,
				title: "Validate Reorder",
			})
			.returning();
		if (!createdPlaylist) {
			throw new Error("Failed to create playlist fixture");
		}

		const c1 = await createContentRow(admin.id, { title: "Episode 1" });
		const c2 = await createContentRow(admin.id, { title: "Episode 2" });

		const inserted = await testDb.db
			.insert(playlistEpisode)
			.values([
				{
					playlistId: createdPlaylist.id,
					contentId: c1.id,
					episodeOrder: 1,
				},
				{
					playlistId: createdPlaylist.id,
					contentId: c2.id,
					episodeOrder: 2,
				},
			])
			.returning();

		const first = inserted[0];
		if (!first) {
			throw new Error("Failed to create playlist episode fixture");
		}

		await expect(
			reorderPlaylistEpisodes({
				db: testDb.db,
				input: {
					playlistId: createdPlaylist.id,
					episodeIds: [first.id, first.id],
				},
			})
		).rejects.toThrow(PlaylistReorderValidationError);

		await expect(
			reorderPlaylistEpisodes({
				db: testDb.db,
				input: {
					playlistId: createdPlaylist.id,
					episodeIds: [first.id],
				},
			})
		).rejects.toThrow(PlaylistReorderValidationError);

		await expect(
			reorderPlaylistEpisodes({
				db: testDb.db,
				input: {
					playlistId: createdPlaylist.id,
					episodeIds: [first.id, "00000000-0000-0000-0000-000000000000"],
				},
			})
		).rejects.toThrow(PlaylistReorderValidationError);
	});
});
