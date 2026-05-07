import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	course,
	courseLesson,
	courseLessonView,
	coursePurchase,
	courseReview,
	order,
	payment,
	userLibrary,
	watchProgress,
} from "@/lib/db/schema";
import { createTestUser } from "../../../__tests__/helpers/factories";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "../../../__tests__/helpers/test-db";
import {
	createCaller,
	makeAuthenticatedContext,
	makeTestContext,
} from "../../../orpc/__tests__/helpers";

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

	async function createCourseRow(
		creatorId: string,
		overrides: Partial<typeof course.$inferInsert> = {}
	) {
		const [row] = await testDb.db
			.insert(course)
			.values({
				creatorId,
				title: overrides.title ?? "Course",
				description: overrides.description ?? null,
				thumbnailImageId: overrides.thumbnailImageId ?? null,
				isPublished: overrides.isPublished ?? true,
				publishedAt:
					overrides.publishedAt === undefined
						? new Date("2025-01-01T00:00:00.000Z")
						: overrides.publishedAt,
				isAvailable: overrides.isAvailable ?? true,
				isDeleted: overrides.isDeleted ?? false,
				deletedAt: overrides.deletedAt ?? null,
			})
			.returning();

		if (!row) {
			throw new Error("Failed to create course fixture");
		}

		return row;
	}

	async function createLessonRow(
		courseId: string,
		overrides: Partial<typeof courseLesson.$inferInsert> = {}
	) {
		const [row] = await testDb.db
			.insert(courseLesson)
			.values({
				courseId,
				lessonOrder: overrides.lessonOrder ?? 1,
				title: overrides.title ?? "Lesson",
				description: overrides.description ?? null,
				thumbnailImageId: overrides.thumbnailImageId ?? null,
				duration: overrides.duration ?? 100,
				releaseDate:
					overrides.releaseDate ?? new Date("2025-01-01T00:00:00.000Z"),
				fileId: overrides.fileId ?? null,
			})
			.returning();

		if (!row) {
			throw new Error("Failed to create lesson fixture");
		}

		return row;
	}

	async function createOrderFixture(params: {
		userId: string;
		courseId: string;
		totalAmount: string;
		status: "PAID" | "REFUNDED";
		createdAt: Date;
		createOwnership?: boolean;
	}) {
		const [createdOrder] = await testDb.db
			.insert(order)
			.values({
				userId: params.userId,
				totalAmount: params.totalAmount,
				currency: "USD",
				itemType: "COURSE",
				courseId: params.courseId,
				status: params.status,
				createdAt: params.createdAt,
				updatedAt: params.createdAt,
			})
			.returning();

		if (!createdOrder) {
			throw new Error("Failed to create order fixture");
		}

		await testDb.db.insert(payment).values({
			orderId: createdOrder.id,
			providerTransactionId: `txn-${createdOrder.id}`,
			provider: "mock",
			amount: params.totalAmount,
			currency: "USD",
			status: params.status === "PAID" ? "SUCCESS" : "FAILED",
			paidAt: params.status === "PAID" ? params.createdAt : null,
			failureReason: params.status === "PAID" ? null : "refunded",
		});

		if (params.status === "PAID" && params.createOwnership !== false) {
			await testDb.db.insert(coursePurchase).values({
				courseId: params.courseId,
				userId: params.userId,
				purchasedAt: params.createdAt,
				price: params.totalAmount,
				status: "PAID",
				orderId: createdOrder.id,
			});
			await testDb.db.insert(userLibrary).values({
				userId: params.userId,
				courseId: params.courseId,
				orderId: createdOrder.id,
				acquiredAt: params.createdAt,
				expiresAt: null,
			});
		}

		return createdOrder;
	}

	async function seedAnalyticsFixture() {
		const creatorA = await createTestUser(testDb.client, {
			email: "analytics-creator-a@example.com",
			name: "Creator Alpha",
			role: "admin",
		});
		const creatorB = await createTestUser(testDb.client, {
			email: "analytics-creator-b@example.com",
			name: "Creator Beta",
			role: "admin",
		});
		const student1 = await createTestUser(testDb.client, {
			email: "analytics-student-1@example.com",
		});
		const student2 = await createTestUser(testDb.client, {
			email: "analytics-student-2@example.com",
		});
		const student3 = await createTestUser(testDb.client, {
			email: "analytics-student-3@example.com",
		});

		const courseA1 = await createCourseRow(creatorA.id, {
			title: "Alpha Course",
			isPublished: true,
			publishedAt: new Date("2025-01-01T00:00:00.000Z"),
		});
		const courseA2 = await createCourseRow(creatorA.id, {
			title: "Alpha Draft Course",
			isPublished: false,
			publishedAt: null,
		});
		const courseB1 = await createCourseRow(creatorB.id, {
			title: "Beta Course",
			isPublished: true,
			publishedAt: new Date("2025-01-03T00:00:00.000Z"),
		});

		const lessonA1 = await createLessonRow(courseA1.id, {
			lessonOrder: 1,
			title: "Alpha Lesson 1",
			duration: 100,
		});
		const lessonA2 = await createLessonRow(courseA1.id, {
			lessonOrder: 2,
			title: "Alpha Lesson 2",
			duration: 100,
		});
		await createLessonRow(courseA2.id, {
			lessonOrder: 1,
			title: "Draft Lesson",
			duration: 100,
		});
		const lessonB1 = await createLessonRow(courseB1.id, {
			lessonOrder: 1,
			title: "Beta Lesson 1",
			duration: 100,
		});

		await testDb.db.insert(courseLessonView).values([
			{
				courseLessonId: lessonA1.id,
				userId: student1.id,
				sessionId: null,
				viewedAt: new Date("2025-01-05T00:00:00.000Z"),
				watchDuration: 90,
				deviceType: "desktop",
			},
			{
				courseLessonId: lessonA2.id,
				userId: student1.id,
				sessionId: null,
				viewedAt: new Date("2025-01-06T00:00:00.000Z"),
				watchDuration: 80,
				deviceType: "desktop",
			},
			{
				courseLessonId: lessonA1.id,
				userId: student3.id,
				sessionId: null,
				viewedAt: new Date("2025-01-07T00:00:00.000Z"),
				watchDuration: 30,
				deviceType: "mobile",
			},
			{
				courseLessonId: lessonB1.id,
				userId: student1.id,
				sessionId: null,
				viewedAt: new Date("2025-01-08T00:00:00.000Z"),
				watchDuration: 20,
				deviceType: "desktop",
			},
			{
				courseLessonId: lessonB1.id,
				userId: student2.id,
				sessionId: null,
				viewedAt: new Date("2025-01-09T00:00:00.000Z"),
				watchDuration: 50,
				deviceType: "mobile",
			},
		]);

		await testDb.db.insert(watchProgress).values([
			{
				courseId: courseA1.id,
				courseLessonId: lessonA1.id,
				userId: student1.id,
				lastPosition: 100,
				duration: 100,
				isCompleted: true,
				updatedAt: new Date("2025-01-05T00:00:00.000Z"),
				deviceType: "desktop",
			},
			{
				courseId: courseA1.id,
				courseLessonId: lessonA2.id,
				userId: student1.id,
				lastPosition: 100,
				duration: 100,
				isCompleted: true,
				updatedAt: new Date("2025-01-06T00:00:00.000Z"),
				deviceType: "desktop",
			},
			{
				courseId: courseA1.id,
				courseLessonId: lessonA1.id,
				userId: student2.id,
				lastPosition: 50,
				duration: 100,
				isCompleted: false,
				updatedAt: new Date("2025-01-07T00:00:00.000Z"),
				deviceType: "mobile",
			},
			{
				courseId: courseB1.id,
				courseLessonId: lessonB1.id,
				userId: student1.id,
				lastPosition: 20,
				duration: 100,
				isCompleted: false,
				updatedAt: new Date("2025-01-08T00:00:00.000Z"),
				deviceType: "desktop",
			},
			{
				courseId: courseB1.id,
				courseLessonId: lessonB1.id,
				userId: student2.id,
				lastPosition: 100,
				duration: 100,
				isCompleted: true,
				updatedAt: new Date("2025-01-09T00:00:00.000Z"),
				deviceType: "mobile",
			},
		]);

		await createOrderFixture({
			userId: student1.id,
			courseId: courseA1.id,
			totalAmount: "100.00",
			status: "PAID",
			createdAt: new Date("2025-01-05T00:00:00.000Z"),
		});
		await createOrderFixture({
			userId: student2.id,
			courseId: courseA1.id,
			totalAmount: "100.00",
			status: "PAID",
			createdAt: new Date("2025-01-06T00:00:00.000Z"),
		});
		await createOrderFixture({
			userId: student2.id,
			courseId: courseB1.id,
			totalAmount: "60.00",
			status: "PAID",
			createdAt: new Date("2025-01-07T00:00:00.000Z"),
		});
		await createOrderFixture({
			userId: student3.id,
			courseId: courseA1.id,
			totalAmount: "20.00",
			status: "REFUNDED",
			createdAt: new Date("2025-01-10T00:00:00.000Z"),
			createOwnership: false,
		});

		await testDb.db.insert(courseReview).values([
			{
				courseId: courseA1.id,
				userId: student1.id,
				rating: 5,
				comment: "Great",
				isVisible: true,
				hiddenAt: null,
				hiddenBy: null,
				moderationReason: null,
				createdAt: new Date("2025-01-05T00:00:00.000Z"),
				updatedAt: new Date("2025-01-05T00:00:00.000Z"),
			},
			{
				courseId: courseA1.id,
				userId: student2.id,
				rating: 1,
				comment: "Hidden",
				isVisible: false,
				hiddenAt: new Date("2025-01-06T00:00:00.000Z"),
				hiddenBy: creatorA.id,
				moderationReason: "spam",
				createdAt: new Date("2025-01-06T00:00:00.000Z"),
				updatedAt: new Date("2025-01-06T00:00:00.000Z"),
			},
			{
				courseId: courseB1.id,
				userId: student3.id,
				rating: 4,
				comment: "Solid",
				isVisible: true,
				hiddenAt: null,
				hiddenBy: null,
				moderationReason: null,
				createdAt: new Date("2025-01-07T00:00:00.000Z"),
				updatedAt: new Date("2025-01-07T00:00:00.000Z"),
			},
		]);

		return {
			creatorA,
			creatorB,
			student1,
			student2,
			student3,
			courseA1,
			courseA2,
			courseB1,
			lessonA1,
			lessonA2,
			lessonB1,
		};
	}

	it("returns zero-safe overview metrics when no data exists", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "analytics-empty-admin@example.com",
			role: "admin",
		});
		const caller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);

		const result = await caller.analytics.overview({});

		expect(result).toMatchObject({
			totalViews: 0,
			totalWatchDuration: 0,
			uniqueViewers: 0,
			totalCourses: 0,
			publishedCourses: 0,
			totalEnrollments: 0,
			activeEnrollments: 0,
			learnersStarted: 0,
			courseCompletions: 0,
			grossRevenue: 0,
			refundedRevenue: 0,
			netRevenue: 0,
			visibleReviewCount: 0,
			averageRating: null,
		});
	});

	it("aggregates overview metrics correctly and applies creator filters", async () => {
		const fixture = await seedAnalyticsFixture();
		const caller = createCaller(
			makeAuthenticatedContext(fixture.creatorA.id, "admin", { db: testDb.db })
		);

		const result = await caller.analytics.overview({});
		expect(result).toMatchObject({
			totalViews: 5,
			totalWatchDuration: 270,
			uniqueViewers: 3,
			totalCourses: 3,
			publishedCourses: 2,
			totalEnrollments: 3,
			activeEnrollments: 3,
			learnersStarted: 2,
			courseCompletions: 2,
			grossRevenue: 260,
			refundedRevenue: 20,
			netRevenue: 240,
			visibleReviewCount: 2,
			averageRating: 4.5,
		});

		const creatorScoped = await caller.analytics.overview({
			creatorId: fixture.creatorA.id,
		});
		expect(creatorScoped).toMatchObject({
			totalViews: 3,
			totalWatchDuration: 200,
			uniqueViewers: 2,
			totalCourses: 2,
			publishedCourses: 1,
			totalEnrollments: 2,
			activeEnrollments: 2,
			learnersStarted: 2,
			courseCompletions: 1,
			grossRevenue: 200,
			refundedRevenue: 20,
			netRevenue: 180,
			visibleReviewCount: 1,
			averageRating: 5,
		});
	});

	it("returns instructor breakdown sorted by net revenue by default", async () => {
		const fixture = await seedAnalyticsFixture();
		const caller = createCaller(
			makeAuthenticatedContext(fixture.creatorA.id, "admin", { db: testDb.db })
		);

		const result = await caller.analytics.instructorBreakdown({});

		expect(result.items).toHaveLength(2);
		expect(result.items[0]).toMatchObject({
			creatorId: fixture.creatorA.id,
			creatorName: "Creator Alpha",
			courseCount: 2,
			publishedCourses: 1,
			totalEnrollments: 2,
			activeEnrollments: 2,
			learnersStarted: 2,
			courseCompletions: 1,
			totalViews: 3,
			totalWatchDuration: 200,
			grossRevenue: 200,
			refundedRevenue: 20,
			netRevenue: 180,
			visibleReviewCount: 1,
			averageRating: 5,
		});
		expect(result.items[1]).toMatchObject({
			creatorId: fixture.creatorB.id,
			netRevenue: 60,
		});
	});

	it("returns course performance with search and pagination support", async () => {
		const fixture = await seedAnalyticsFixture();
		const caller = createCaller(
			makeAuthenticatedContext(fixture.creatorA.id, "admin", { db: testDb.db })
		);

		const result = await caller.analytics.coursePerformance({
			creatorId: fixture.creatorA.id,
			search: "Alpha",
			page: 1,
			limit: 1,
		});

		expect(result.pagination).toMatchObject({
			page: 1,
			limit: 1,
			total: 2,
			totalPages: 2,
		});
		expect(result.items[0]).toMatchObject({
			courseId: fixture.courseA1.id,
			courseTitle: "Alpha Course",
			lessonCount: 2,
			totalEnrollments: 2,
			activeEnrollments: 2,
			learnersStarted: 2,
			activationRate: 1,
			courseCompletions: 1,
			completionRate: 0.5,
			totalViews: 3,
			totalWatchDuration: 200,
			averageWatchDurationPerViewer: 100,
			grossRevenue: 200,
			refundedRevenue: 20,
			netRevenue: 180,
			visibleReviewCount: 1,
			averageRating: 5,
		});
	});

	it("returns course lesson engagement metrics with completion and drop-off", async () => {
		const fixture = await seedAnalyticsFixture();
		const caller = createCaller(
			makeAuthenticatedContext(fixture.creatorA.id, "admin", { db: testDb.db })
		);

		const result = await caller.analytics.courseLessonEngagement({
			courseId: fixture.courseA1.id,
		});

		expect(result.items).toHaveLength(2);
		expect(result.items[0]).toMatchObject({
			courseLessonId: fixture.lessonA1.id,
			totalViews: 2,
			uniqueViewers: 2,
			learnersStarted: 2,
			learnersCompleted: 1,
			completionRate: 0.5,
			avgProgressPercent: 75,
			dropOffRate: 25,
			aggregatedWatchDuration: 120,
		});
		expect(result.items[1]).toMatchObject({
			courseLessonId: fixture.lessonA2.id,
			totalViews: 1,
			uniqueViewers: 1,
			learnersStarted: 1,
			learnersCompleted: 1,
			completionRate: 1,
			avgProgressPercent: 100,
			dropOffRate: 0,
			aggregatedWatchDuration: 80,
		});
	});

	it("enforces admin-only access", async () => {
		const fixture = await seedAnalyticsFixture();
		const userCaller = createCaller(
			makeAuthenticatedContext(fixture.student1.id, "user", { db: testDb.db })
		);
		const anonymousCaller = createCaller(makeTestContext({ db: testDb.db }));

		await expect(userCaller.analytics.overview({})).rejects.toThrow(
			expect.objectContaining({
				code: "FORBIDDEN",
			})
		);
		await expect(anonymousCaller.analytics.overview({})).rejects.toThrow(
			expect.objectContaining({
				code: "UNAUTHORIZED",
			})
		);
	});
});
