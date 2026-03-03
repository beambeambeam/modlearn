import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestUser } from "@/__tests__/helpers/factories";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "@/__tests__/helpers/test-db";
import { and, eq } from "@/lib/db/orm";
import { content, playlist, playlistEpisode } from "@/lib/db/schema";
import {
	addEpisodeToPlaylist,
	createPlaylist,
	deletePlaylist,
	getPlaylistByIdWithEpisodes,
	listPlaylistEpisodes,
	listPlaylists,
	removeEpisodeFromPlaylist,
	reorderPlaylistEpisodes,
	updatePlaylist,
	updatePlaylistEpisode,
} from "@/modules/playlist/playlist.service";
import {
	ContentNotFoundError,
	PlaylistEpisodeDuplicateContentError,
	PlaylistEpisodeNotFoundError,
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

	it("listPlaylists supports pagination, search and isSeries filters", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "playlist-list-all@example.com",
		});

		await testDb.db.insert(playlist).values([
			{ creatorId: admin.id, title: "Season Alpha", isSeries: true },
			{ creatorId: admin.id, title: "Season Beta", isSeries: true },
			{ creatorId: admin.id, title: "Movie Bundle", isSeries: false },
		]);

		const filtered = await listPlaylists({
			db: testDb.db,
			input: {
				search: "season",
				isSeries: true,
				page: 1,
				limit: 10,
			},
		});

		expect(filtered.items).toHaveLength(2);
		expect(filtered.pagination.total).toBe(2);

		const paged = await listPlaylists({
			db: testDb.db,
			input: {
				page: 2,
				limit: 2,
			},
		});

		expect(paged.items).toHaveLength(1);
		expect(paged.pagination.total).toBe(3);
		expect(paged.pagination.totalPages).toBe(2);
	});

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

	it("updatePlaylist applies patch and throws when playlist is missing", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "playlist-update@example.com",
		});
		const created = await createPlaylist({
			db: testDb.db,
			input: { title: "Before" },
			creatorId: admin.id,
		});

		const updated = await updatePlaylist({
			db: testDb.db,
			input: {
				id: created.id,
				patch: {
					title: "After",
					description: "desc",
				},
			},
		});
		expect(updated.title).toBe("After");
		expect(updated.description).toBe("desc");

		await expect(
			updatePlaylist({
				db: testDb.db,
				input: {
					id: "00000000-0000-0000-0000-000000000000",
					patch: { title: "x" },
				},
			})
		).rejects.toThrow(PlaylistNotFoundError);
	});

	it("deletePlaylist hard-deletes and cascades episodes", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "playlist-delete@example.com",
		});
		const contentRow = await createContentRow(admin.id);
		const created = await createPlaylist({
			db: testDb.db,
			input: { title: "To Delete" },
			creatorId: admin.id,
		});

		await testDb.db.insert(playlistEpisode).values({
			playlistId: created.id,
			contentId: contentRow.id,
			episodeOrder: 1,
		});

		const deleted = await deletePlaylist({
			db: testDb.db,
			input: { id: created.id },
		});
		expect(deleted).toEqual({ id: created.id, deleted: true });

		const playlistRows = await testDb.db
			.select()
			.from(playlist)
			.where(eq(playlist.id, created.id));
		const episodeRows = await testDb.db
			.select()
			.from(playlistEpisode)
			.where(eq(playlistEpisode.playlistId, created.id));
		expect(playlistRows).toHaveLength(0);
		expect(episodeRows).toHaveLength(0);
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

	it("addEpisodeToPlaylist rejects duplicate content in same playlist", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "playlist-add-dupe@example.com",
		});
		const created = await createPlaylist({
			db: testDb.db,
			input: { title: "Dupes" },
			creatorId: admin.id,
		});
		const contentRow = await createContentRow(admin.id);

		await addEpisodeToPlaylist({
			db: testDb.db,
			input: {
				playlistId: created.id,
				contentId: contentRow.id,
			},
		});

		await expect(
			addEpisodeToPlaylist({
				db: testDb.db,
				input: {
					playlistId: created.id,
					contentId: contentRow.id,
				},
			})
		).rejects.toThrow(PlaylistEpisodeDuplicateContentError);
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

	it("updatePlaylistEpisode updates metadata fields", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "playlist-update-episode-meta@example.com",
		});
		const created = await createPlaylist({
			db: testDb.db,
			input: { title: "Metadata playlist" },
			creatorId: admin.id,
		});
		const episodeContent = await createContentRow(admin.id, { title: "E1" });
		const added = await addEpisodeToPlaylist({
			db: testDb.db,
			input: {
				playlistId: created.id,
				contentId: episodeContent.id,
			},
		});

		const updated = await updatePlaylistEpisode({
			db: testDb.db,
			input: {
				id: added.id,
				patch: {
					title: "Pilot",
					episodeNumber: 10,
				},
			},
		});

		expect(updated.title).toBe("Pilot");
		expect(updated.episodeNumber).toBe(10);
		expect(updated.episodeOrder).toBe(1);
	});

	it("updatePlaylistEpisode reorders within a season and between seasons", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "playlist-update-episode-order@example.com",
		});
		const created = await createPlaylist({
			db: testDb.db,
			input: { title: "Order playlist" },
			creatorId: admin.id,
		});
		const c1 = await createContentRow(admin.id, { title: "S1E1" });
		const c2 = await createContentRow(admin.id, { title: "S1E2" });
		const c3 = await createContentRow(admin.id, { title: "S1E3" });
		const c4 = await createContentRow(admin.id, { title: "S2E1" });

		const e1 = await addEpisodeToPlaylist({
			db: testDb.db,
			input: { playlistId: created.id, contentId: c1.id, seasonNumber: 1 },
		});
		const e2 = await addEpisodeToPlaylist({
			db: testDb.db,
			input: { playlistId: created.id, contentId: c2.id, seasonNumber: 1 },
		});
		const e3 = await addEpisodeToPlaylist({
			db: testDb.db,
			input: { playlistId: created.id, contentId: c3.id, seasonNumber: 1 },
		});
		await addEpisodeToPlaylist({
			db: testDb.db,
			input: { playlistId: created.id, contentId: c4.id, seasonNumber: 2 },
		});

		await updatePlaylistEpisode({
			db: testDb.db,
			input: {
				id: e3.id,
				patch: {
					episodeOrder: 1,
				},
			},
		});

		const seasonOneRows = await testDb.db
			.select()
			.from(playlistEpisode)
			.where(
				and(
					eq(playlistEpisode.playlistId, created.id),
					eq(playlistEpisode.seasonNumber, 1)
				)
			)
			.orderBy(playlistEpisode.episodeOrder);
		expect(seasonOneRows.map((row) => row.id)).toEqual([e3.id, e1.id, e2.id]);
		expect(seasonOneRows.map((row) => row.episodeOrder)).toEqual([1, 2, 3]);

		await updatePlaylistEpisode({
			db: testDb.db,
			input: {
				id: e2.id,
				patch: {
					seasonNumber: 2,
					episodeOrder: 1,
				},
			},
		});

		const seasonOneAfterMove = await testDb.db
			.select()
			.from(playlistEpisode)
			.where(
				and(
					eq(playlistEpisode.playlistId, created.id),
					eq(playlistEpisode.seasonNumber, 1)
				)
			)
			.orderBy(playlistEpisode.episodeOrder);
		expect(seasonOneAfterMove.map((row) => row.episodeOrder)).toEqual([1, 2]);

		const seasonTwoAfterMove = await testDb.db
			.select()
			.from(playlistEpisode)
			.where(
				and(
					eq(playlistEpisode.playlistId, created.id),
					eq(playlistEpisode.seasonNumber, 2)
				)
			)
			.orderBy(playlistEpisode.episodeOrder);
		expect(seasonTwoAfterMove.map((row) => row.id)[0]).toBe(e2.id);
		expect(seasonTwoAfterMove.map((row) => row.episodeOrder)).toEqual([1, 2]);
	});

	it("updatePlaylistEpisode validates duplicates and missing IDs", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "playlist-update-episode-errors@example.com",
		});
		const created = await createPlaylist({
			db: testDb.db,
			input: { title: "Error playlist" },
			creatorId: admin.id,
		});
		const c1 = await createContentRow(admin.id, { title: "A" });
		const c2 = await createContentRow(admin.id, { title: "B" });
		const c3 = await createContentRow(admin.id, { title: "C" });

		const e1 = await addEpisodeToPlaylist({
			db: testDb.db,
			input: { playlistId: created.id, contentId: c1.id },
		});
		await addEpisodeToPlaylist({
			db: testDb.db,
			input: { playlistId: created.id, contentId: c2.id },
		});

		await expect(
			updatePlaylistEpisode({
				db: testDb.db,
				input: {
					id: e1.id,
					patch: {
						contentId: c2.id,
					},
				},
			})
		).rejects.toThrow(PlaylistEpisodeDuplicateContentError);

		await expect(
			updatePlaylistEpisode({
				db: testDb.db,
				input: {
					id: e1.id,
					patch: {
						contentId: "00000000-0000-0000-0000-000000000000",
					},
				},
			})
		).rejects.toThrow(ContentNotFoundError);

		await expect(
			updatePlaylistEpisode({
				db: testDb.db,
				input: {
					id: "00000000-0000-0000-0000-000000000000",
					patch: {
						contentId: c3.id,
					},
				},
			})
		).rejects.toThrow(PlaylistEpisodeNotFoundError);
	});

	it("removeEpisodeFromPlaylist deletes and compacts order", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "playlist-remove-episode@example.com",
		});
		const created = await createPlaylist({
			db: testDb.db,
			input: { title: "Remove playlist" },
			creatorId: admin.id,
		});
		const c1 = await createContentRow(admin.id, { title: "1" });
		const c2 = await createContentRow(admin.id, { title: "2" });
		const c3 = await createContentRow(admin.id, { title: "3" });

		await addEpisodeToPlaylist({
			db: testDb.db,
			input: { playlistId: created.id, contentId: c1.id, seasonNumber: 1 },
		});
		const middle = await addEpisodeToPlaylist({
			db: testDb.db,
			input: { playlistId: created.id, contentId: c2.id, seasonNumber: 1 },
		});
		await addEpisodeToPlaylist({
			db: testDb.db,
			input: { playlistId: created.id, contentId: c3.id, seasonNumber: 1 },
		});

		const deleted = await removeEpisodeFromPlaylist({
			db: testDb.db,
			input: { id: middle.id },
		});
		expect(deleted).toEqual({
			id: middle.id,
			playlistId: created.id,
			deleted: true,
		});

		const rows = await testDb.db
			.select()
			.from(playlistEpisode)
			.where(eq(playlistEpisode.playlistId, created.id))
			.orderBy(playlistEpisode.episodeOrder);
		expect(rows.map((row) => row.episodeOrder)).toEqual([1, 2]);

		await expect(
			removeEpisodeFromPlaylist({
				db: testDb.db,
				input: { id: middle.id },
			})
		).rejects.toThrow(PlaylistEpisodeNotFoundError);
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
