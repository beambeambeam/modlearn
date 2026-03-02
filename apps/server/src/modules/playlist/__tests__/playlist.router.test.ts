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

	it("allows public access to getByIdWithEpisodes and listEpisodes", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "playlist-router-public@example.com",
			role: "admin",
		});
		const [createdPlaylist] = await testDb.db
			.insert(playlist)
			.values({
				creatorId: admin.id,
				title: "Router Playlist",
			})
			.returning();
		if (!createdPlaylist) {
			throw new Error("Failed to create playlist fixture");
		}

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

		const detail = await caller.playlist.getByIdWithEpisodes({
			id: createdPlaylist.id,
		});
		expect(detail.id).toBe(createdPlaylist.id);
		expect(detail.episodes).toHaveLength(1);

		const episodes = await caller.playlist.listEpisodes({
			playlistId: createdPlaylist.id,
		});
		expect(episodes).toHaveLength(1);
	});

	it("rejects invalid public input", async () => {
		const caller = createCaller(makeTestContext({ db: testDb.db }));

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
	});

	it("allows admin and superadmin to perform admin mutations", async () => {
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

		const added = await adminCaller.playlist.adminAddEpisode({
			playlistId: created.id,
			contentId: episodeContent.id,
		});
		expect(added.playlistId).toBe(created.id);
		expect(added.episodeOrder).toBe(1);

		const auditRows = await testDb.db.select().from(adminAuditLog);
		const addEpisodeAudit = auditRows.find(
			(row) =>
				row.entityType === "PLAYLIST_EPISODE" &&
				row.action === "ADD_EPISODE" &&
				row.entityId === added.id &&
				row.adminId === admin.id
		);
		expect(addEpisodeAudit).toBeDefined();
		expect(addEpisodeAudit?.metadata).toEqual({
			playlistId: created.id,
			contentId: episodeContent.id,
		});

		const reordered = await superadminCaller.playlist.adminReorderEpisodes({
			playlistId: created.id,
			episodeIds: [added.id],
		});
		expect(reordered).toHaveLength(1);
		expect(reordered[0]?.id).toBe(added.id);
		expect(reordered[0]?.episodeOrder).toBe(1);
	});
});
