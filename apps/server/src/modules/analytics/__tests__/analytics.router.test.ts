import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestUser } from "@/__tests__/helpers/factories";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "@/__tests__/helpers/test-db";
import { content, contentView } from "@/lib/db/schema";
import {
	createCaller,
	makeAuthenticatedContext,
	makeTestContext,
} from "@/orpc/__tests__/helpers";

async function seedRouterAnalyticsData(params: {
	testDb: TestDatabase;
	adminId: string;
	userId: string;
}) {
	const { testDb, adminId, userId } = params;
	const [movie] = await testDb.db
		.insert(content)
		.values({
			title: "Router Analytics Movie",
			contentType: "MOVIE",
			updatedBy: adminId,
			isPublished: true,
			isAvailable: true,
			viewCount: 1,
		})
		.returning();

	if (!movie) {
		throw new Error("Failed to create analytics router content fixture");
	}

	await testDb.db.insert(contentView).values({
		contentId: movie.id,
		userId,
		watchDuration: 90,
		deviceType: "web",
	});

	return { movie };
}

describe("analytics router", () => {
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

		await expect(caller.analytics.overview({})).rejects.toThrow(
			expect.objectContaining({ code: "UNAUTHORIZED" })
		);
	});

	it("rejects non-admin access", async () => {
		const user = await createTestUser(testDb.client, {
			email: "analytics-router-user@example.com",
		});
		const caller = createCaller(
			makeAuthenticatedContext(user.id, "user", { db: testDb.db })
		);

		await expect(caller.analytics.overview({})).rejects.toThrow(
			expect.objectContaining({ code: "FORBIDDEN" })
		);
	});

	it("allows admin access to overview/content views/session endpoints", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "analytics-router-admin@example.com",
			role: "admin",
		});
		const user = await createTestUser(testDb.client, {
			email: "analytics-router-seeded-user@example.com",
		});
		const seeded = await seedRouterAnalyticsData({
			testDb,
			adminId: admin.id,
			userId: user.id,
		});

		const caller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);

		const overview = await caller.analytics.overview({});
		expect(overview.totalViews).toBe(1);

		const contentViews = await caller.analytics.contentViews({
			search: "Router Analytics",
		});
		expect(contentViews.items).toHaveLength(1);
		expect(contentViews.items[0]?.contentId).toBe(seeded.movie.id);

		const viewSessions = await caller.analytics.viewSessions({
			contentId: seeded.movie.id,
		});
		expect(viewSessions.items).toHaveLength(1);
		expect(viewSessions.items[0]?.contentId).toBe(seeded.movie.id);
	});

	it("rejects invalid input", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "analytics-router-validation-admin@example.com",
			role: "admin",
		});
		const caller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);

		await expect(
			caller.analytics.overview({
				from: new Date("invalid"),
			})
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));

		await expect(
			caller.analytics.viewSessions({
				contentId: "not-a-uuid",
			})
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
	});
});
