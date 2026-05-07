import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { course, order, userLibrary } from "@/lib/db/schema";
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

describe("review router", () => {
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
	}

	it("allows public review summary and listing for anonymous callers", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "review-router-admin-public@example.com",
			role: "admin",
		});
		const reviewer = await createTestUser(testDb.client, {
			email: "review-router-public-reviewer@example.com",
		});
		const publicCourse = await createCourseRow(admin.id);
		await grantLibraryAccess(reviewer.id, publicCourse.id);

		const caller = createCaller(
			makeAuthenticatedContext(reviewer.id, "user", { db: testDb.db })
		);
		await caller.review.upsertMine({
			courseId: publicCourse.id,
			rating: 4,
			comment: "Public review",
		});

		const anonymousCaller = createCaller(makeTestContext({ db: testDb.db }));
		const summary = await anonymousCaller.review.getCourseSummary({
			courseId: publicCourse.id,
		});
		expect(summary.ratingCount).toBe(1);
		expect(summary.averageRating).toBe(4);

		const listed = await anonymousCaller.review.listByCourse({
			courseId: publicCourse.id,
		});
		expect(listed.items).toHaveLength(1);
		expect(listed.items[0]?.comment).toBe("Public review");
	});

	it("enforces authentication, admin role, and ownership", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "review-router-admin@example.com",
			role: "admin",
		});
		const owner = await createTestUser(testDb.client, {
			email: "review-router-owner@example.com",
		});
		const nonOwner = await createTestUser(testDb.client, {
			email: "review-router-non-owner@example.com",
		});
		const publicCourse = await createCourseRow(admin.id);
		await grantLibraryAccess(owner.id, publicCourse.id);

		const unauthenticatedCaller = createCaller(
			makeTestContext({ db: testDb.db })
		);
		await expect(
			unauthenticatedCaller.review.upsertMine({
				courseId: publicCourse.id,
				rating: 5,
			})
		).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));

		const ownerCaller = createCaller(
			makeAuthenticatedContext(owner.id, "user", { db: testDb.db })
		);
		const created = await ownerCaller.review.upsertMine({
			courseId: publicCourse.id,
			rating: 5,
			comment: "Owner review",
		});
		expect(created.rating).toBe(5);

		const nonOwnerCaller = createCaller(
			makeAuthenticatedContext(nonOwner.id, "user", { db: testDb.db })
		);
		await expect(
			nonOwnerCaller.review.upsertMine({
				courseId: publicCourse.id,
				rating: 2,
				comment: "Blocked",
			})
		).rejects.toThrow(expect.objectContaining({ code: "FORBIDDEN" }));

		await expect(ownerCaller.review.adminList({})).rejects.toThrow(
			expect.objectContaining({ code: "FORBIDDEN" })
		);
	});

	it("supports getMine, deleteMine, and hidden review visibility for the author", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "review-router-admin-moderation@example.com",
			role: "admin",
		});
		const owner = await createTestUser(testDb.client, {
			email: "review-router-owner-moderation@example.com",
		});
		const publicCourse = await createCourseRow(admin.id);
		await grantLibraryAccess(owner.id, publicCourse.id);

		const ownerCaller = createCaller(
			makeAuthenticatedContext(owner.id, "user", { db: testDb.db })
		);
		const adminCaller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);

		const created = await ownerCaller.review.upsertMine({
			courseId: publicCourse.id,
			rating: 3,
			comment: "Needs work",
		});

		await adminCaller.review.adminHide({
			reviewId: created.id,
			reason: "moderated",
		});

		const mine = await ownerCaller.review.getMine({
			courseId: publicCourse.id,
		});
		expect(mine?.isVisible).toBe(false);
		expect(mine?.moderationReason).toBe("moderated");

		const anonymousCaller = createCaller(makeTestContext({ db: testDb.db }));
		const listed = await anonymousCaller.review.listByCourse({
			courseId: publicCourse.id,
		});
		expect(listed.items).toHaveLength(0);

		const deleted = await ownerCaller.review.deleteMine({
			courseId: publicCourse.id,
		});
		expect(deleted).toEqual({
			courseId: publicCourse.id,
			deleted: true,
		});
	});

	it("rejects invalid payloads with bad request errors", async () => {
		const caller = createCaller(makeTestContext({ db: testDb.db }));

		await expect(
			caller.review.listByCourse({
				courseId: "not-a-uuid",
			})
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
		await expect(
			caller.review.getCourseSummary({
				courseId: "not-a-uuid",
			})
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));

		const admin = await createTestUser(testDb.client, {
			email: "review-router-admin-invalid@example.com",
			role: "admin",
		});
		const adminCaller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);

		await expect(
			adminCaller.review.adminHide({
				reviewId: "not-a-uuid",
			})
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
	});
});
