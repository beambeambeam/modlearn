import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestUser } from "@/__tests__/helpers/factories";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "@/__tests__/helpers/test-db";
import { content, contentView } from "@/lib/db/schema";
import {
	getAnalyticsOverview,
	listContentViewsAnalytics,
	listViewSessionsAnalytics,
} from "@/modules/analytics/analytics.service";

async function seedAnalyticsData(testDb: TestDatabase) {
	const admin = await createTestUser(testDb.client, {
		email: "analytics-service-admin@example.com",
		role: "admin",
	});
	const userA = await createTestUser(testDb.client, {
		email: "analytics-service-user-a@example.com",
	});
	const userB = await createTestUser(testDb.client, {
		email: "analytics-service-user-b@example.com",
	});

	const [contentA] = await testDb.db
		.insert(content)
		.values({
			title: "Analytics Movie A",
			contentType: "MOVIE",
			updatedBy: admin.id,
			isPublished: true,
			isAvailable: true,
			viewCount: 2,
		})
		.returning();
	const [contentB] = await testDb.db
		.insert(content)
		.values({
			title: "Analytics Movie B",
			contentType: "MOVIE",
			updatedBy: admin.id,
			isPublished: true,
			isAvailable: true,
			viewCount: 1,
		})
		.returning();

	if (!(contentA && contentB)) {
		throw new Error("Failed to create analytics content fixtures");
	}

	await testDb.db.insert(contentView).values([
		{
			contentId: contentA.id,
			userId: userA.id,
			watchDuration: 75,
			deviceType: "web",
		},
		{
			contentId: contentB.id,
			userId: userB.id,
			watchDuration: 40,
			deviceType: "mobile",
		},
	]);

	return { userA, userB, contentA, contentB };
}

describe("analytics service", () => {
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

	it("returns overview totals", async () => {
		await seedAnalyticsData(testDb);

		const overview = await getAnalyticsOverview({
			db: testDb.db,
			input: {},
		});

		expect(overview.totalViews).toBe(2);
		expect(overview.totalWatchDuration).toBe(115);
		expect(overview.generatedAt).toBeInstanceOf(Date);
	});

	it("returns paginated per-content aggregates", async () => {
		const seeded = await seedAnalyticsData(testDb);

		const result = await listContentViewsAnalytics({
			db: testDb.db,
			input: {
				page: 1,
				limit: 10,
				search: "Analytics Movie",
			},
		});

		expect(result.pagination.total).toBe(2);
		const contentAItem = result.items.find(
			(item) => item.contentId === seeded.contentA.id
		);
		expect(contentAItem?.aggregatedViews).toBe(1);
		expect(contentAItem?.aggregatedWatchDuration).toBe(75);
		expect(contentAItem?.cachedViewCount).toBe(2);
	});

	it("returns session rows with filters", async () => {
		const seeded = await seedAnalyticsData(testDb);

		const sessions = await listViewSessionsAnalytics({
			db: testDb.db,
			input: {
				page: 1,
				limit: 10,
				userId: seeded.userA.id,
				contentId: seeded.contentA.id,
			},
		});

		expect(sessions.pagination.total).toBe(1);
		expect(sessions.items).toHaveLength(1);
		expect(sessions.items[0]?.userId).toBe(seeded.userA.id);
		expect(sessions.items[0]?.contentId).toBe(seeded.contentA.id);
	});
});
