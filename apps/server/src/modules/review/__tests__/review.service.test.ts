import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "@/lib/db/orm";
import { course, courseReview, order, userLibrary } from "@/lib/db/schema";
import { createTestUser } from "../../../__tests__/helpers/factories";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "../../../__tests__/helpers/test-db";
import {
	adminDeleteReview,
	adminHideReview,
	adminUnhideReview,
	deleteMyCourseReview,
	getCourseReviewSummary,
	getMyCourseReview,
	listCourseReviews,
	upsertMyCourseReview,
} from "../review.service";

describe("review service", () => {
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
					overrides.publishedAt ?? new Date("2025-01-01T00:00:00.000Z"),
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

	async function grantLibraryAccess(userId: string, courseId: string) {
		const [createdOrder] = await testDb.db
			.insert(order)
			.values({
				userId,
				totalAmount: "10.00",
				currency: "USD",
				itemType: "COURSE",
				courseId,
				status: "PAID",
			})
			.returning();

		if (!createdOrder) {
			throw new Error("Failed to create order fixture");
		}

		await testDb.db.insert(userLibrary).values({
			userId,
			courseId,
			orderId: createdOrder.id,
		});

		return createdOrder;
	}

	it("creates, updates, and summarizes an owned course review", async () => {
		const creator = await createTestUser(testDb.client, {
			email: "review-service-creator@example.com",
			role: "admin",
		});
		const reviewer = await createTestUser(testDb.client, {
			email: "review-service-owner@example.com",
		});
		const createdCourse = await createCourseRow(creator.id);
		await grantLibraryAccess(reviewer.id, createdCourse.id);

		const created = await upsertMyCourseReview({
			db: testDb.db,
			userId: reviewer.id,
			input: {
				courseId: createdCourse.id,
				rating: 5,
				comment: "  Great course  ",
			},
		});
		expect(created.rating).toBe(5);
		expect(created.comment).toBe("Great course");
		expect(created.author.displayName).toBe("Test User");

		const updated = await upsertMyCourseReview({
			db: testDb.db,
			userId: reviewer.id,
			input: {
				courseId: createdCourse.id,
				rating: 2,
				comment: "  ",
			},
		});
		expect(updated.rating).toBe(2);
		expect(updated.comment).toBeNull();

		const summary = await getCourseReviewSummary({
			db: testDb.db,
			input: { courseId: createdCourse.id },
		});
		expect(summary.averageRating).toBe(2);
		expect(summary.ratingCount).toBe(1);
		expect(summary.ratingBreakdown[2]).toBe(1);
		expect(summary.ratingBreakdown[5]).toBe(0);

		const rows = await testDb.db.select().from(courseReview);
		expect(rows).toHaveLength(1);
	});

	it("rejects review creation for a user without active ownership", async () => {
		const creator = await createTestUser(testDb.client, {
			email: "review-service-creator-2@example.com",
			role: "admin",
		});
		const reviewer = await createTestUser(testDb.client, {
			email: "review-service-non-owner@example.com",
		});
		const createdCourse = await createCourseRow(creator.id);

		await expect(
			upsertMyCourseReview({
				db: testDb.db,
				userId: reviewer.id,
				input: {
					courseId: createdCourse.id,
					rating: 4,
					comment: "Blocked",
				},
			})
		).rejects.toThrow("Active course ownership is required");
	});

	it("deletes only the caller's own review", async () => {
		const creator = await createTestUser(testDb.client, {
			email: "review-service-creator-3@example.com",
			role: "admin",
		});
		const reviewer = await createTestUser(testDb.client, {
			email: "review-service-delete@example.com",
		});
		const createdCourse = await createCourseRow(creator.id);
		await grantLibraryAccess(reviewer.id, createdCourse.id);
		await upsertMyCourseReview({
			db: testDb.db,
			userId: reviewer.id,
			input: {
				courseId: createdCourse.id,
				rating: 3,
				comment: "Delete me",
			},
		});

		const result = await deleteMyCourseReview({
			db: testDb.db,
			userId: reviewer.id,
			input: { courseId: createdCourse.id },
		});

		expect(result).toEqual({
			courseId: createdCourse.id,
			deleted: true,
		});

		const remaining = await testDb.db.select().from(courseReview);
		expect(remaining).toHaveLength(0);
	});

	it("hides, unhides, and deletes reviews through admin moderation", async () => {
		const creator = await createTestUser(testDb.client, {
			email: "review-service-creator-4@example.com",
			role: "admin",
		});
		const moderator = await createTestUser(testDb.client, {
			email: "review-service-moderator@example.com",
			role: "admin",
		});
		const reviewer = await createTestUser(testDb.client, {
			email: "review-service-moderated@example.com",
		});
		const createdCourse = await createCourseRow(creator.id);
		await grantLibraryAccess(reviewer.id, createdCourse.id);
		const created = await upsertMyCourseReview({
			db: testDb.db,
			userId: reviewer.id,
			input: {
				courseId: createdCourse.id,
				rating: 5,
				comment: "Visible",
			},
		});

		const hidden = await adminHideReview({
			db: testDb.db,
			adminUserId: moderator.id,
			input: {
				reviewId: created.id,
				reason: "Policy",
			},
		});
		expect(hidden.isVisible).toBe(false);
		expect(hidden.hiddenBy).toBe(moderator.id);
		expect(hidden.moderationReason).toBe("Policy");

		const hiddenMine = await getMyCourseReview({
			db: testDb.db,
			userId: reviewer.id,
			input: { courseId: createdCourse.id },
		});
		expect(hiddenMine?.isVisible).toBe(false);

		const publicListWhileHidden = await listCourseReviews({
			db: testDb.db,
			input: {
				courseId: createdCourse.id,
			},
		});
		expect(publicListWhileHidden.items).toHaveLength(0);

		const hiddenSummary = await getCourseReviewSummary({
			db: testDb.db,
			input: { courseId: createdCourse.id },
		});
		expect(hiddenSummary.ratingCount).toBe(0);

		const unhidden = await adminUnhideReview({
			db: testDb.db,
			input: {
				reviewId: created.id,
			},
		});
		expect(unhidden.isVisible).toBe(true);
		expect(unhidden.hiddenAt).toBeNull();

		const deleted = await adminDeleteReview({
			db: testDb.db,
			input: {
				reviewId: created.id,
			},
		});
		expect(deleted).toEqual({
			reviewId: created.id,
			deleted: true,
		});

		const row = await testDb.db.query.courseReview.findFirst({
			where: eq(courseReview.id, created.id),
		});
		expect(row).toBeUndefined();
	});

	it("lists only visible reviews and resolves display name fallbacks", async () => {
		const creator = await createTestUser(testDb.client, {
			email: "review-service-creator-5@example.com",
			role: "admin",
		});
		const firstReviewer = await createTestUser(testDb.client, {
			email: "review-service-display-1@example.com",
			name: "Name Fallback",
			username: "username-fallback",
			displayUsername: "Display Fallback",
		});
		const secondReviewer = await createTestUser(testDb.client, {
			email: "review-service-display-2@example.com",
			name: "Only Name",
			username: "only-username",
		});
		const thirdReviewer = await createTestUser(testDb.client, {
			email: "review-service-display-3@example.com",
			name: "Name Only",
		});
		const createdCourse = await createCourseRow(creator.id);

		for (const reviewer of [firstReviewer, secondReviewer, thirdReviewer]) {
			await grantLibraryAccess(reviewer.id, createdCourse.id);
		}

		const first = await upsertMyCourseReview({
			db: testDb.db,
			userId: firstReviewer.id,
			input: { courseId: createdCourse.id, rating: 5, comment: "First" },
		});
		await upsertMyCourseReview({
			db: testDb.db,
			userId: secondReviewer.id,
			input: { courseId: createdCourse.id, rating: 4, comment: "Second" },
		});
		await upsertMyCourseReview({
			db: testDb.db,
			userId: thirdReviewer.id,
			input: { courseId: createdCourse.id, rating: 1, comment: "Third" },
		});

		await adminHideReview({
			db: testDb.db,
			adminUserId: creator.id,
			input: { reviewId: first.id, reason: "hide" },
		});

		const listed = await listCourseReviews({
			db: testDb.db,
			input: {
				courseId: createdCourse.id,
				sortBy: "HIGHEST_RATING",
			},
		});

		expect(listed.items).toHaveLength(2);
		expect(listed.items[0]?.author.displayName).toBe("only-username");
		expect(listed.items[1]?.author.displayName).toBe("Name Only");
	});
});
