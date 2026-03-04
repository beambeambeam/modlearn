import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestUser } from "@/__tests__/helpers/factories";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "@/__tests__/helpers/test-db";
import {
	adminAuditLog,
	content,
	playlist,
	playlistEpisode,
	playlistPricing,
} from "@/lib/db/schema";
import {
	createCaller,
	makeAuthenticatedContext,
	makeTestContext,
} from "@/orpc/__tests__/helpers";

describe("playlist router", () => {
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

	it("allows public access to list, getByIdWithEpisodes and listEpisodes with active pricing", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "playlist-router-public@example.com",
			role: "admin",
		});
		const [createdPlaylist, noPricePlaylist] = await testDb.db
			.insert(playlist)
			.values([
				{
					creatorId: admin.id,
					title: "Router Playlist",
					isPublished: true,
					isAvailable: true,
					publishedAt: new Date("2025-01-01T00:00:00.000Z"),
				},
				{
					creatorId: admin.id,
					title: "No Price Playlist",
					isPublished: true,
					isAvailable: true,
					publishedAt: new Date("2025-01-01T00:00:00.000Z"),
				},
			])
			.returning();
		if (!(createdPlaylist && noPricePlaylist)) {
			throw new Error("Failed to create playlist fixture");
		}
		await testDb.db.insert(playlistPricing).values({
			playlistId: createdPlaylist.id,
			price: "42.00",
			currency: "usd",
			effectiveFrom: new Date("2025-01-01"),
			createdBy: admin.id,
		});

		const [episodeContent] = await testDb.db
			.insert(content)
			.values({
				title: "Episode",
				contentType: "EPISODE",
				updatedBy: admin.id,
				isPublished: true,
				isAvailable: true,
				publishedAt: new Date("2025-01-01T00:00:00.000Z"),
			})
			.returning();
		if (!episodeContent) {
			throw new Error("Failed to create content fixture");
		}

		await testDb.db.insert(playlistEpisode).values({
			playlistId: createdPlaylist.id,
			contentId: episodeContent.id,
			episodeOrder: 1,
			seasonNumber: 1,
		});

		const caller = createCaller(makeTestContext({ db: testDb.db }));

		const listed = await caller.playlist.list({});
		expect(listed.items.length).toBeGreaterThanOrEqual(2);
		const pricedPlaylistFromList = listed.items.find(
			(item) => item.id === createdPlaylist.id
		);
		const noPricePlaylistFromList = listed.items.find(
			(item) => item.id === noPricePlaylist.id
		);
		expect(pricedPlaylistFromList?.activePricing).toEqual({
			price: "42.00",
			currency: "USD",
		});
		expect(noPricePlaylistFromList?.activePricing).toBeNull();

		const detail = await caller.playlist.getByIdWithEpisodes({
			id: createdPlaylist.id,
		});
		expect(detail.id).toBe(createdPlaylist.id);
		expect(detail.episodes).toHaveLength(1);
		expect(detail.activePricing).toEqual({
			price: "42.00",
			currency: "USD",
		});

		const noPriceDetail = await caller.playlist.getByIdWithEpisodes({
			id: noPricePlaylist.id,
		});
		expect(noPriceDetail.activePricing).toBeNull();

		const episodes = await caller.playlist.listEpisodes({
			playlistId: createdPlaylist.id,
		});
		expect(episodes).toHaveLength(1);
	});

	it("enforces playlist visibility on public list/getByIdWithEpisodes", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "playlist-router-public-visibility@example.com",
			role: "admin",
		});
		const [publishedPlaylist, draftPlaylist] = await testDb.db
			.insert(playlist)
			.values([
				{
					creatorId: admin.id,
					title: "Published Playlist",
					isPublished: true,
					isAvailable: true,
					publishedAt: new Date("2025-01-01T00:00:00.000Z"),
				},
				{
					creatorId: admin.id,
					title: "Draft Playlist",
					isPublished: false,
					isAvailable: true,
					publishedAt: null,
				},
			])
			.returning();
		if (!(publishedPlaylist && draftPlaylist)) {
			throw new Error("Failed to create playlist visibility fixtures");
		}

		const caller = createCaller(makeTestContext({ db: testDb.db }));
		const listed = await caller.playlist.list({
			onlyPublished: false,
		} as unknown as Parameters<typeof caller.playlist.list>[0]);
		expect(listed.items.map((row) => row.id)).toEqual([publishedPlaylist.id]);

		await expect(
			caller.playlist.getByIdWithEpisodes({
				id: draftPlaylist.id,
				onlyPublished: false,
			} as unknown as Parameters<typeof caller.playlist.getByIdWithEpisodes>[0])
		).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
	});

	it("rejects invalid public input", async () => {
		const caller = createCaller(makeTestContext({ db: testDb.db }));

		await expect(
			caller.playlist.list({
				page: 0,
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: "BAD_REQUEST",
			})
		);

		await expect(
			caller.playlist.getByIdWithEpisodes({
				id: "not-a-uuid",
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: "BAD_REQUEST",
			})
		);

		await expect(
			caller.playlist.listEpisodes({
				playlistId: "not-a-uuid",
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: "BAD_REQUEST",
			})
		);
	});

	it("rejects admin mutations for unauthenticated users", async () => {
		const caller = createCaller(makeTestContext({ db: testDb.db }));

		await expect(
			caller.playlist.adminCreate({
				title: "No Auth",
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: "UNAUTHORIZED",
			})
		);

		await expect(caller.playlist.adminList({})).rejects.toThrow(
			expect.objectContaining({
				code: "UNAUTHORIZED",
			})
		);
	});

	it("rejects admin mutations for non-admin users", async () => {
		const user = await createTestUser(testDb.client, {
			email: "playlist-router-user@example.com",
			role: "user",
		});

		const caller = createCaller(
			makeAuthenticatedContext(user.id, "user", { db: testDb.db })
		);

		await expect(
			caller.playlist.adminCreate({
				title: "No Admin",
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: "FORBIDDEN",
			})
		);

		await expect(
			caller.playlist.adminGetByIdWithEpisodes({
				id: "00000000-0000-0000-0000-000000000000",
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: "FORBIDDEN",
			})
		);
	});

	it("allows admin read preview endpoints to include draft playlists", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "playlist-router-admin-preview@example.com",
			role: "admin",
		});
		const [draftPlaylist] = await testDb.db
			.insert(playlist)
			.values({
				creatorId: admin.id,
				title: "Draft Preview Playlist",
				isPublished: false,
				isAvailable: true,
				publishedAt: null,
			})
			.returning();
		if (!draftPlaylist) {
			throw new Error("Failed to create draft playlist fixture");
		}

		const adminCaller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);
		const listed = await adminCaller.playlist.adminList({
			onlyPublished: false,
		});
		expect(listed.items.some((row) => row.id === draftPlaylist.id)).toBe(true);

		const detail = await adminCaller.playlist.adminGetByIdWithEpisodes({
			id: draftPlaylist.id,
			onlyPublished: false,
		});
		expect(detail.id).toBe(draftPlaylist.id);
	});

	it("allows admin and superadmin to perform admin mutations and writes audits", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "playlist-router-admin@example.com",
			role: "admin",
		});
		const superadmin = await createTestUser(testDb.client, {
			email: "playlist-router-superadmin@example.com",
			role: "superadmin",
		});

		const [episodeContent] = await testDb.db
			.insert(content)
			.values({
				title: "Episode Admin",
				contentType: "EPISODE",
				updatedBy: admin.id,
				isPublished: true,
				isAvailable: true,
				publishedAt: new Date("2025-01-01T00:00:00.000Z"),
			})
			.returning();
		if (!episodeContent) {
			throw new Error("Failed to create content fixture");
		}

		const [episodeContent2] = await testDb.db
			.insert(content)
			.values({
				title: "Episode Admin 2",
				contentType: "EPISODE",
				updatedBy: admin.id,
				isPublished: true,
				isAvailable: true,
				publishedAt: new Date("2025-01-01T00:00:00.000Z"),
			})
			.returning();
		if (!episodeContent2) {
			throw new Error("Failed to create content fixture");
		}

		const adminCaller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);
		const superadminCaller = createCaller(
			makeAuthenticatedContext(superadmin.id, "superadmin", { db: testDb.db })
		);

		const created = await adminCaller.playlist.adminCreate({
			title: "Admin Playlist",
		});
		expect(created.title).toBe("Admin Playlist");
		expect(created.isPublished).toBe(false);
		expect(created.isAvailable).toBe(true);

		const updated = await adminCaller.playlist.adminUpdate({
			id: created.id,
			patch: {
				title: "Admin Playlist Updated",
			},
		});
		expect(updated.title).toBe("Admin Playlist Updated");

		const added = await adminCaller.playlist.adminAddEpisode({
			playlistId: created.id,
			contentId: episodeContent.id,
		});
		expect(added.playlistId).toBe(created.id);
		expect(added.episodeOrder).toBe(1);

		const updatedEpisode = await adminCaller.playlist.adminUpdateEpisode({
			id: added.id,
			patch: {
				contentId: episodeContent2.id,
				title: "Renamed Episode",
			},
		});
		expect(updatedEpisode.contentId).toBe(episodeContent2.id);
		expect(updatedEpisode.title).toBe("Renamed Episode");

		const reordered = await superadminCaller.playlist.adminReorderEpisodes({
			playlistId: created.id,
			episodeIds: [added.id],
		});
		expect(reordered).toHaveLength(1);
		expect(reordered[0]?.id).toBe(added.id);
		expect(reordered[0]?.episodeOrder).toBe(1);

		const published = await adminCaller.playlist.adminSetPublishState({
			id: created.id,
			isPublished: true,
		});
		expect(published.isPublished).toBe(true);

		const unavailable = await adminCaller.playlist.adminSetAvailability({
			id: created.id,
			isAvailable: false,
		});
		expect(unavailable.isAvailable).toBe(false);

		const removed = await adminCaller.playlist.adminRemoveEpisode({
			id: added.id,
		});
		expect(removed).toEqual({
			id: added.id,
			playlistId: created.id,
			deleted: true,
		});

		const deleted = await adminCaller.playlist.adminDelete({
			id: created.id,
		});
		expect(deleted).toEqual({
			id: created.id,
			deleted: true,
		});

		const auditRows = await testDb.db.select().from(adminAuditLog);
		expect(
			auditRows.some(
				(row) =>
					row.entityType === "PLAYLIST" &&
					row.action === "SET_PUBLISH_STATE" &&
					row.entityId === created.id
			)
		).toBe(true);
		expect(
			auditRows.some(
				(row) =>
					row.entityType === "PLAYLIST" &&
					row.action === "SET_AVAILABILITY" &&
					row.entityId === created.id
			)
		).toBe(true);
		expect(
			auditRows.some(
				(row) =>
					row.entityType === "PLAYLIST" &&
					row.action === "CREATE" &&
					row.entityId === created.id
			)
		).toBe(true);
		expect(
			auditRows.some(
				(row) =>
					row.entityType === "PLAYLIST" &&
					row.action === "UPDATE" &&
					row.entityId === created.id
			)
		).toBe(true);
		expect(
			auditRows.some(
				(row) =>
					row.entityType === "PLAYLIST_EPISODE" &&
					row.action === "ADD_EPISODE" &&
					row.entityId === added.id
			)
		).toBe(true);
		expect(
			auditRows.some(
				(row) =>
					row.entityType === "PLAYLIST_EPISODE" &&
					row.action === "UPDATE_EPISODE" &&
					row.entityId === added.id
			)
		).toBe(true);
		expect(
			auditRows.some(
				(row) =>
					row.entityType === "PLAYLIST" &&
					row.action === "REORDER_EPISODES" &&
					row.entityId === created.id
			)
		).toBe(true);
		expect(
			auditRows.some(
				(row) =>
					row.entityType === "PLAYLIST_EPISODE" &&
					row.action === "REMOVE_EPISODE" &&
					row.entityId === added.id
			)
		).toBe(true);
		expect(
			auditRows.some(
				(row) =>
					row.entityType === "PLAYLIST" &&
					row.action === "DELETE" &&
					row.entityId === created.id
			)
		).toBe(true);
	});

	it("allows admin publish/availability state mutations", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "playlist-router-state-toggles@example.com",
			role: "admin",
		});
		const caller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);
		const created = await caller.playlist.adminCreate({
			title: "State Playlist",
		});

		const published = await caller.playlist.adminSetPublishState({
			id: created.id,
			isPublished: true,
		});
		expect(published.isPublished).toBe(true);
		expect(published.publishedAt).toBeInstanceOf(Date);

		const unavailable = await caller.playlist.adminSetAvailability({
			id: created.id,
			isAvailable: false,
		});
		expect(unavailable.isAvailable).toBe(false);
	});

	it("maps duplicate episode content to CONFLICT", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "playlist-router-conflict@example.com",
			role: "admin",
		});

		const [episodeContent] = await testDb.db
			.insert(content)
			.values({
				title: "Episode Conflict",
				contentType: "EPISODE",
				updatedBy: admin.id,
				isPublished: true,
				isAvailable: true,
				publishedAt: new Date("2025-01-01T00:00:00.000Z"),
			})
			.returning();
		if (!episodeContent) {
			throw new Error("Failed to create content fixture");
		}

		const caller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);
		const created = await caller.playlist.adminCreate({
			title: "Conflict playlist",
		});
		await caller.playlist.adminAddEpisode({
			playlistId: created.id,
			contentId: episodeContent.id,
		});

		await expect(
			caller.playlist.adminAddEpisode({
				playlistId: created.id,
				contentId: episodeContent.id,
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: "CONFLICT",
			})
		);
	});

	it("maps not found errors for episode update/remove", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "playlist-router-not-found@example.com",
			role: "admin",
		});
		const caller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);

		await expect(
			caller.playlist.adminUpdateEpisode({
				id: "00000000-0000-0000-0000-000000000000",
				patch: {
					title: "x",
				},
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: "NOT_FOUND",
			})
		);

		await expect(
			caller.playlist.adminRemoveEpisode({
				id: "00000000-0000-0000-0000-000000000000",
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: "NOT_FOUND",
			})
		);
	});
});
