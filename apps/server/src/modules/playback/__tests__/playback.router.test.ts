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
import { content, file, order, storage, userLibrary } from "@/lib/db/schema";
import {
	createCaller,
	makeAuthenticatedContext,
	makeTestContext,
} from "@/orpc/__tests__/helpers";

vi.mock("@/lib/storage/s3-operations", () => ({
	resolveDownloadDeliveryUrl: vi.fn(
		async (input: { key: string; cdnUrl?: string | null }) => ({
			url:
				input.cdnUrl ?? `https://cdn.example.com/modlearn-media/${input.key}`,
			expiresAt: null,
			source: "cdn",
		})
	),
}));

async function seedOwnedContent(params: {
	testDb: TestDatabase;
	userId: string;
}) {
	const { testDb, userId } = params;

	const [mediaFile] = await testDb.db
		.insert(file)
		.values({
			uploaderId: userId,
			name: "router-video.mp4",
			size: 1000,
			mimeType: "video/mp4",
			extension: "mp4",
			checksum: "b".repeat(64),
		})
		.returning();

	if (!mediaFile) {
		throw new Error("Failed to create file fixture");
	}

	await testDb.db.insert(storage).values({
		fileId: mediaFile.id,
		storageProvider: "s3",
		storageKey: `files/${mediaFile.id}.mp4`,
		cdnUrl: `https://cdn.example.com/modlearn-media/files/${mediaFile.id}.mp4`,
	});

	const [movie] = await testDb.db
		.insert(content)
		.values({
			title: "Router Owned Movie",
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

	await testDb.db.insert(userLibrary).values({
		userId,
		contentId: movie.id,
		orderId: purchaseOrder.id,
	});

	return movie;
}

describe("playback router", () => {
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

	it("rejects unauthenticated access", async () => {
		const caller = createCaller(makeTestContext({ db: testDb.db }));

		await expect(
			caller.playback.createSession({
				contentId: "00000000-0000-0000-0000-000000000000",
			})
		).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));

		await expect(
			caller.playback.play({
				sessionId: "00000000-0000-0000-0000-000000000000",
				playbackToken: "x".repeat(16),
				position: 1,
				duration: 10,
			})
		).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));

		await expect(
			caller.playback.refreshSession({
				sessionId: "00000000-0000-0000-0000-000000000000",
				playbackToken: "x".repeat(16),
			})
		).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
	});

	it("rejects invalid input", async () => {
		const user = await createTestUser(testDb.client, {
			email: "playback-router-invalid@example.com",
		});
		const caller = createCaller(
			makeAuthenticatedContext(user.id, "user", { db: testDb.db })
		);

		await expect(
			caller.playback.createSession({
				contentId: "bad-id",
			})
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));

		await expect(
			caller.playback.seek({
				sessionId: "00000000-0000-0000-0000-000000000000",
				playbackToken: "x".repeat(16),
				position: 0,
				duration: 0,
			})
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));

		await expect(
			caller.playback.refreshSession({
				sessionId: "bad-id",
				playbackToken: "x".repeat(16),
			})
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
	});

	it("maps domain errors to ORPC codes", async () => {
		const user = await createTestUser(testDb.client, {
			email: "playback-router-errors@example.com",
		});
		const caller = createCaller(
			makeAuthenticatedContext(user.id, "user", { db: testDb.db })
		);

		await expect(
			caller.playback.createSession({
				contentId: "00000000-0000-0000-0000-000000000000",
			})
		).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
	});

	it("supports authenticated session lifecycle", async () => {
		const user = await createTestUser(testDb.client, {
			email: "playback-router-happy@example.com",
		});
		const movie = await seedOwnedContent({
			testDb,
			userId: user.id,
		});

		const caller = createCaller(
			makeAuthenticatedContext(user.id, "user", { db: testDb.db })
		);

		const created = await caller.playback.createSession({
			contentId: movie.id,
			deviceType: "web",
		});
		expect(created.streamUrl).toBe(
			`https://cdn.example.com/modlearn-media/files/${movie.fileId}.mp4`
		);
		expect(created.streamUrlExpiresAt).toBeNull();
		const refreshed = await caller.playback.refreshSession({
			sessionId: created.sessionId,
			playbackToken: created.playbackToken,
		});
		expect(refreshed.sessionId).toBe(created.sessionId);
		expect(refreshed.playbackToken).toBe(created.playbackToken);
		expect(refreshed.tokenExpiresAt.getTime()).toBeGreaterThan(
			created.tokenExpiresAt.getTime()
		);

		const played = await caller.playback.play({
			sessionId: created.sessionId,
			playbackToken: created.playbackToken,
			position: 10,
			duration: 100,
			deviceType: "web",
		});
		expect(played.event.eventType).toBe("PLAY");

		const paused = await caller.playback.pause({
			sessionId: created.sessionId,
			playbackToken: created.playbackToken,
			position: 20,
			duration: 100,
			deviceType: "web",
		});
		expect(paused.session.status).toBe("PAUSED");

		const resumed = await caller.playback.resume({
			sessionId: created.sessionId,
			playbackToken: created.playbackToken,
			position: 20,
			duration: 100,
			deviceType: "web",
		});
		expect(resumed.session.status).toBe("ACTIVE");

		const seeked = await caller.playback.seek({
			sessionId: created.sessionId,
			playbackToken: created.playbackToken,
			position: 75,
			duration: 100,
			fromPosition: 20,
			deviceType: "web",
		});
		expect(seeked.event.eventType).toBe("SEEK");

		const stopped = await caller.playback.stop({
			sessionId: created.sessionId,
			playbackToken: created.playbackToken,
			position: 100,
			duration: 100,
			deviceType: "web",
		});
		expect(stopped.session.status).toBe("STOPPED");
		expect(stopped.isCompleted).toBe(true);

		const session = await caller.playback.getSession({
			sessionId: created.sessionId,
			playbackToken: created.playbackToken,
		});
		expect(session.session.id).toBe(created.sessionId);
	});
});
