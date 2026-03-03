import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { createTestUser } from "@/__tests__/helpers/factories";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "@/__tests__/helpers/test-db";
import { eq } from "@/lib/db/orm";
import {
	content,
	contentView,
	file,
	order,
	playbackSession,
	playlist,
	playlistEpisode,
	storage,
	userLibrary,
	watchProgress,
} from "@/lib/db/schema";
import { generateDownloadUrl } from "@/lib/storage/s3-operations";
import {
	createPlaybackSession,
	getPlaybackSession,
	recordPlaybackPause,
	recordPlaybackPlay,
	recordPlaybackResume,
	recordPlaybackSeek,
	recordPlaybackStop,
} from "@/modules/playback/playback.service";
import {
	PlaybackAccessDeniedError,
	PlaybackSessionExpiredError,
	PlaybackTokenInvalidError,
} from "@/modules/playback/playback.types";

vi.mock("@/lib/storage/s3-operations", () => ({
	generateDownloadUrl: vi.fn(async () => ({
		downloadUrl: "https://example.com/stream.m3u8",
		expiresAt: new Date("2026-03-04T00:00:00.000Z"),
	})),
}));

async function seedOwnedPlayableContent(params: {
	testDb: TestDatabase;
	userId: string;
	includePlaylist?: boolean;
}) {
	const { testDb, userId, includePlaylist = false } = params;

	const [mediaFile] = await testDb.db
		.insert(file)
		.values({
			uploaderId: userId,
			name: "owned-video.mp4",
			size: 1024,
			mimeType: "video/mp4",
			extension: "mp4",
			checksum: "a".repeat(64),
		})
		.returning();

	if (!mediaFile) {
		throw new Error("Failed to create media file fixture");
	}

	await testDb.db.insert(storage).values({
		fileId: mediaFile.id,
		storageProvider: "s3",
		storageKey: `files/${mediaFile.id}.mp4`,
	});

	const [movie] = await testDb.db
		.insert(content)
		.values({
			title: "Owned Movie",
			contentType: "MOVIE",
			updatedBy: userId,
			isPublished: true,
			isAvailable: true,
			fileId: mediaFile.id,
			duration: 100,
		})
		.returning();

	if (!movie) {
		throw new Error("Failed to create content fixture");
	}

	const [purchaseOrder] = await testDb.db
		.insert(order)
		.values({
			userId,
			totalAmount: "10.00",
			currency: "USD",
			status: "PAID",
		})
		.returning();

	if (!purchaseOrder) {
		throw new Error("Failed to create order fixture");
	}

	let series: typeof playlist.$inferSelect | null = null;
	if (includePlaylist) {
		const [createdPlaylist] = await testDb.db
			.insert(playlist)
			.values({
				creatorId: userId,
				title: "Series A",
			})
			.returning();

		if (!createdPlaylist) {
			throw new Error("Failed to create playlist fixture");
		}

		series = createdPlaylist;

		await testDb.db.insert(playlistEpisode).values({
			playlistId: series.id,
			contentId: movie.id,
			episodeOrder: 1,
		});
	}

	await testDb.db.insert(userLibrary).values({
		userId,
		contentId: movie.id,
		playlistId: series?.id ?? null,
		orderId: purchaseOrder.id,
	});

	return {
		content: movie,
		playlist: series,
		file: mediaFile,
	};
}

describe("playback service", () => {
	let testDb: TestDatabase;

	beforeAll(async () => {
		testDb = await createTestDatabase();
	});

	beforeEach(async () => {
		await resetTestDatabase(testDb.client);
		vi.clearAllMocks();
	});

	afterAll(async () => {
		await testDb.cleanup();
	});

	it("createPlaybackSession returns token, signed url, and invalidates prior active sessions", async () => {
		const user = await createTestUser(testDb.client, {
			email: "playback-create@example.com",
		});
		const seeded = await seedOwnedPlayableContent({
			testDb,
			userId: user.id,
		});

		await testDb.db.insert(watchProgress).values({
			userId: user.id,
			contentId: seeded.content.id,
			lastPosition: 40,
			duration: 100,
			isCompleted: false,
		});

		const first = await createPlaybackSession({
			db: testDb.db,
			input: {
				userId: user.id,
				contentId: seeded.content.id,
				deviceType: "web",
			},
		});

		expect(first.streamUrl).toBe("https://example.com/stream.m3u8");
		expect(first.resumePosition).toBe(40);
		expect(first.playbackToken.length).toBeGreaterThan(16);
		expect(generateDownloadUrl).toHaveBeenCalledWith(
			expect.objectContaining({
				key: `files/${seeded.file.id}.mp4`,
				inline: true,
			})
		);

		const second = await createPlaybackSession({
			db: testDb.db,
			input: {
				userId: user.id,
				contentId: seeded.content.id,
				deviceType: "web",
			},
		});

		expect(second.sessionId).not.toBe(first.sessionId);

		const [firstSession] = await testDb.db
			.select()
			.from(playbackSession)
			.where(eq(playbackSession.id, first.sessionId));
		expect(firstSession?.status).toBe("EXPIRED");
	});

	it("createPlaybackSession rejects users without entitlement", async () => {
		const owner = await createTestUser(testDb.client, {
			email: "playback-owner@example.com",
		});
		const stranger = await createTestUser(testDb.client, {
			email: "playback-stranger@example.com",
		});
		const seeded = await seedOwnedPlayableContent({
			testDb,
			userId: owner.id,
		});

		await expect(
			createPlaybackSession({
				db: testDb.db,
				input: {
					userId: stranger.id,
					contentId: seeded.content.id,
				},
			})
		).rejects.toThrow(PlaybackAccessDeniedError);
	});

	it("records play/pause/resume/seek/stop lifecycle and syncs completion analytics", async () => {
		const user = await createTestUser(testDb.client, {
			email: "playback-lifecycle@example.com",
		});
		const seeded = await seedOwnedPlayableContent({
			testDb,
			userId: user.id,
			includePlaylist: true,
		});

		const created = await createPlaybackSession({
			db: testDb.db,
			input: {
				userId: user.id,
				contentId: seeded.content.id,
				playlistId: seeded.playlist?.id,
				deviceType: "web",
			},
		});

		await recordPlaybackPlay({
			db: testDb.db,
			input: {
				userId: user.id,
				sessionId: created.sessionId,
				playbackToken: created.playbackToken,
				position: 10,
				duration: 100,
				deviceType: "web",
			},
		});

		await recordPlaybackPause({
			db: testDb.db,
			input: {
				userId: user.id,
				sessionId: created.sessionId,
				playbackToken: created.playbackToken,
				position: 20,
				duration: 100,
				deviceType: "web",
			},
		});

		await recordPlaybackResume({
			db: testDb.db,
			input: {
				userId: user.id,
				sessionId: created.sessionId,
				playbackToken: created.playbackToken,
				position: 20,
				duration: 100,
				deviceType: "web",
			},
		});

		await recordPlaybackSeek({
			db: testDb.db,
			input: {
				userId: user.id,
				sessionId: created.sessionId,
				playbackToken: created.playbackToken,
				position: 50,
				duration: 100,
				fromPosition: 20,
				deviceType: "web",
			},
		});

		const stopped = await recordPlaybackStop({
			db: testDb.db,
			input: {
				userId: user.id,
				sessionId: created.sessionId,
				playbackToken: created.playbackToken,
				position: 100,
				duration: 100,
				deviceType: "web",
			},
		});

		expect(stopped.session.status).toBe("STOPPED");
		expect(stopped.isCompleted).toBe(true);
		expect(stopped.progressPercent).toBe(100);

		const [progressRow] = await testDb.db
			.select()
			.from(watchProgress)
			.where(eq(watchProgress.contentId, seeded.content.id));
		expect(progressRow?.isCompleted).toBe(true);
		expect(progressRow?.lastPosition).toBe(100);

		const [viewRow] = await testDb.db
			.select()
			.from(contentView)
			.where(eq(contentView.contentId, seeded.content.id));
		expect(viewRow).toBeDefined();
		expect(viewRow?.watchDuration).toBe(100);

		const [contentRow] = await testDb.db
			.select({ viewCount: content.viewCount })
			.from(content)
			.where(eq(content.id, seeded.content.id));
		expect(contentRow?.viewCount).toBe(1);
	});

	it("getPlaybackSession validates token and marks expired sessions", async () => {
		const user = await createTestUser(testDb.client, {
			email: "playback-get-session@example.com",
		});
		const seeded = await seedOwnedPlayableContent({
			testDb,
			userId: user.id,
		});

		const created = await createPlaybackSession({
			db: testDb.db,
			input: {
				userId: user.id,
				contentId: seeded.content.id,
			},
		});

		await expect(
			getPlaybackSession({
				db: testDb.db,
				input: {
					userId: user.id,
					sessionId: created.sessionId,
					playbackToken: "invalid-token",
				},
			})
		).rejects.toThrow(PlaybackTokenInvalidError);

		await testDb.db
			.update(playbackSession)
			.set({ expiresAt: new Date(Date.now() - 1000) })
			.where(eq(playbackSession.id, created.sessionId));

		await expect(
			getPlaybackSession({
				db: testDb.db,
				input: {
					userId: user.id,
					sessionId: created.sessionId,
					playbackToken: created.playbackToken,
				},
			})
		).rejects.toThrow(PlaybackSessionExpiredError);

		const [expiredSession] = await testDb.db
			.select({ status: playbackSession.status })
			.from(playbackSession)
			.where(eq(playbackSession.id, created.sessionId));
		expect(expiredSession?.status).toBe("EXPIRED");
	});
});
