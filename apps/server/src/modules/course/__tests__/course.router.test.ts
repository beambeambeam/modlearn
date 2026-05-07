import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	category,
	course,
	courseLesson,
	courseLessonView,
	coursePricing,
	courseReview,
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

describe("course router", () => {
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
				duration: overrides.duration ?? 1000,
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

	async function createCoursePricingRow(courseId: string, createdBy: string) {
		const [row] = await testDb.db
			.insert(coursePricing)
			.values({
				courseId,
				price: "12.50",
				currency: "usd",
				effectiveFrom: new Date("2025-01-01T00:00:00.000Z"),
				createdBy,
			})
			.returning();

		if (!row) {
			throw new Error("Failed to create course pricing fixture");
		}

		return row;
	}

	it("allows public access to list/getById/listPopular/listLessons with active pricing", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-router-public@example.com",
			role: "admin",
		});
		const reviewer = await createTestUser(testDb.client, {
			email: "course-router-reviewer@example.com",
			displayUsername: "Public Reviewer",
		});
		const pricedCourse = await createCourseRow(admin.id, {
			title: "Public Course",
		});
		const noPriceCourse = await createCourseRow(admin.id, {
			title: "No Price Course",
		});
		await createCoursePricingRow(pricedCourse.id, admin.id);
		const lesson = await createLessonRow(pricedCourse.id, {
			title: "Lesson",
		});
		await createLessonRow(noPriceCourse.id, {
			title: "No Price Lesson",
		});
		await testDb.db.insert(courseLessonView).values({
			courseLessonId: lesson.id,
			watchDuration: 120,
		});
		await testDb.db.insert(courseReview).values({
			courseId: pricedCourse.id,
			userId: reviewer.id,
			rating: 5,
			comment: "Excellent course",
			isVisible: true,
			hiddenAt: null,
			hiddenBy: null,
			moderationReason: null,
		});

		const caller = createCaller(makeTestContext({ db: testDb.db }));

		const listResult = await caller.course.list({});
		expect(listResult.items).toHaveLength(2);
		expect(
			listResult.items.find((item) => item.id === pricedCourse.id)
				?.activePricing
		).toEqual({
			price: "12.50",
			currency: "USD",
		});
		expect(
			listResult.items.find((item) => item.id === noPriceCourse.id)
				?.activePricing
		).toBeNull();
		expect(
			listResult.items.find((item) => item.id === pricedCourse.id)
				?.reviewSummary
		).toEqual({
			averageRating: 5,
			ratingCount: 1,
		});
		expect(
			listResult.items.find((item) => item.id === noPriceCourse.id)
				?.reviewSummary
		).toEqual({
			averageRating: null,
			ratingCount: 0,
		});

		const detailResult = await caller.course.getById({ id: pricedCourse.id });
		expect(detailResult.id).toBe(pricedCourse.id);
		expect(detailResult.activePricing).toEqual({
			price: "12.50",
			currency: "USD",
		});
		expect(detailResult.lessons).toHaveLength(1);
		expect(detailResult.reviewSummary).toEqual({
			averageRating: 5,
			ratingCount: 1,
		});
		expect(detailResult.recentReviews).toHaveLength(1);
		expect(detailResult.recentReviews[0]?.author.displayName).toBe(
			"Public Reviewer"
		);

		const popularResult = await caller.course.listPopular({});
		expect(popularResult[0]?.id).toBe(pricedCourse.id);
		expect(popularResult[0]?.reviewSummary).toEqual({
			averageRating: 5,
			ratingCount: 1,
		});

		const lessonResult = await caller.course.listLessons({
			courseId: pricedCourse.id,
		});
		expect(lessonResult).toHaveLength(1);
		expect(lessonResult[0]?.id).toBe(lesson.id);
	});

	it("excludes hidden reviews from public course summaries and recent reviews", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-router-hidden-review-admin@example.com",
			role: "admin",
		});
		const visibleReviewer = await createTestUser(testDb.client, {
			email: "course-router-hidden-visible@example.com",
			displayUsername: "Visible Reviewer",
		});
		const hiddenReviewer = await createTestUser(testDb.client, {
			email: "course-router-hidden-hidden@example.com",
			displayUsername: "Hidden Reviewer",
		});
		const publicCourse = await createCourseRow(admin.id);

		await testDb.db.insert(courseReview).values([
			{
				courseId: publicCourse.id,
				userId: visibleReviewer.id,
				rating: 4,
				comment: "Visible",
				isVisible: true,
				hiddenAt: null,
				hiddenBy: null,
				moderationReason: null,
			},
			{
				courseId: publicCourse.id,
				userId: hiddenReviewer.id,
				rating: 1,
				comment: "Hidden",
				isVisible: false,
				hiddenAt: new Date("2025-01-03T00:00:00.000Z"),
				hiddenBy: admin.id,
				moderationReason: "policy",
			},
		]);

		const caller = createCaller(makeTestContext({ db: testDb.db }));
		const detail = await caller.course.getById({ id: publicCourse.id });

		expect(detail.reviewSummary).toEqual({
			averageRating: 4,
			ratingCount: 1,
		});
		expect(detail.recentReviews).toHaveLength(1);
		expect(detail.recentReviews[0]?.author.displayName).toBe(
			"Visible Reviewer"
		);
	});

	it("rejects invalid public input", async () => {
		const caller = createCaller(makeTestContext({ db: testDb.db }));

		await expect(caller.course.list({ page: 0 })).rejects.toThrow(
			expect.objectContaining({ code: "BAD_REQUEST" })
		);
		await expect(caller.course.list({ limit: 51 })).rejects.toThrow(
			expect.objectContaining({ code: "BAD_REQUEST" })
		);
		await expect(caller.course.getById({ id: "not-a-uuid" })).rejects.toThrow(
			expect.objectContaining({ code: "BAD_REQUEST" })
		);
		await expect(
			caller.course.list({
				categoryIds: [
					"00000000-0000-0000-0000-000000000001",
					"00000000-0000-0000-0000-000000000001",
				],
			})
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
		await expect(
			caller.course.listLessons({ courseId: "not-a-uuid" })
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
	});

	it("enforces published-only visibility on public endpoints", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-router-public-visibility@example.com",
			role: "admin",
		});
		const publishedCourse = await createCourseRow(admin.id, {
			title: "Published Course",
		});
		const draftCourse = await createCourseRow(admin.id, {
			title: "Draft Course",
			isPublished: false,
			publishedAt: null,
		});
		await createLessonRow(publishedCourse.id, { title: "Visible Lesson" });
		await createLessonRow(draftCourse.id, { title: "Hidden Lesson" });

		const caller = createCaller(makeTestContext({ db: testDb.db }));
		const listed = await caller.course.list({
			onlyPublished: false,
		} as unknown as Parameters<typeof caller.course.list>[0]);
		expect(listed.items.map((row) => row.id)).toEqual([publishedCourse.id]);

		await expect(
			caller.course.getById({
				id: draftCourse.id,
				onlyPublished: false,
			} as unknown as Parameters<typeof caller.course.getById>[0])
		).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));

		await expect(
			caller.course.listLessons({
				courseId: draftCourse.id,
				onlyPublished: false,
			} as unknown as Parameters<typeof caller.course.listLessons>[0])
		).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
	});

	it("allows admin read endpoints to preview unpublished courses", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-router-admin-preview@example.com",
			role: "admin",
		});
		const publishedCourse = await createCourseRow(admin.id, {
			title: "Published Course",
		});
		const draftCourse = await createCourseRow(admin.id, {
			title: "Draft Course",
			isPublished: false,
			publishedAt: null,
		});

		const adminCaller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);
		const adminList = await adminCaller.course.adminList({
			onlyPublished: false,
		});
		expect(adminList.items.map((row) => row.id).sort()).toEqual(
			[publishedCourse.id, draftCourse.id].sort()
		);

		const adminDetail = await adminCaller.course.adminGetById({
			id: draftCourse.id,
			onlyPublished: false,
		});
		expect(adminDetail.id).toBe(draftCourse.id);
		expect(adminDetail.isPublished).toBe(false);
	});

	it("rejects admin endpoints for unauthenticated users", async () => {
		const caller = createCaller(makeTestContext({ db: testDb.db }));

		await expect(
			caller.course.adminCreate({ title: "No Auth" })
		).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
		await expect(caller.course.adminList({})).rejects.toThrow(
			expect.objectContaining({ code: "UNAUTHORIZED" })
		);
		await expect(
			caller.course.adminUpdate({
				id: "00000000-0000-0000-0000-000000000000",
				patch: { title: "No Auth" },
			})
		).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
	});

	it("rejects admin endpoints for non-admin users", async () => {
		const user = await createTestUser(testDb.client, {
			email: "course-router-user@example.com",
			role: "user",
		});
		const caller = createCaller(
			makeAuthenticatedContext(user.id, "user", { db: testDb.db })
		);

		await expect(
			caller.course.adminCreate({ title: "No Admin" })
		).rejects.toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
		await expect(
			caller.course.adminGetById({
				id: "00000000-0000-0000-0000-000000000000",
			})
		).rejects.toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
	});

	it("allows admin and superadmin to run admin course mutations", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-router-admin@example.com",
			role: "admin",
		});
		const superadmin = await createTestUser(testDb.client, {
			email: "course-router-superadmin@example.com",
			role: "superadmin",
		});
		const createdCategory = await testDb.db
			.insert(category)
			.values({
				title: "Education",
				slug: "education",
			})
			.returning();
		const categoryRow = createdCategory[0];
		if (!categoryRow) {
			throw new Error("Failed to create category fixture");
		}

		const adminCaller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);
		const created = await adminCaller.course.adminCreate({
			title: "Created Course",
			description: "Desc",
		});
		expect(created.creatorId).toBe(admin.id);

		const updated = await adminCaller.course.adminUpdate({
			id: created.id,
			patch: { title: "Updated Course" },
		});
		expect(updated.title).toBe("Updated Course");

		const classified = await adminCaller.course.adminSetClassification({
			id: created.id,
			categoryIds: [categoryRow.id],
		});
		expect(classified.categories.map((row) => row.id)).toEqual([
			categoryRow.id,
		]);

		await adminCaller.course.adminAddLesson({
			courseId: created.id,
			title: "Lesson 1",
		});

		const published = await adminCaller.course.adminSetPublishState({
			id: created.id,
			isPublished: true,
		});
		expect(published.isPublished).toBe(true);

		const unavailable = await adminCaller.course.adminSetAvailability({
			id: created.id,
			isAvailable: false,
		});
		expect(unavailable.isAvailable).toBe(false);

		const superadminCaller = createCaller(
			makeAuthenticatedContext(superadmin.id, "superadmin", { db: testDb.db })
		);
		const deleted = await superadminCaller.course.adminDelete({
			id: created.id,
		});
		expect(deleted.deleted).toBe(true);
	});

	it("allows admin lesson mutations", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-router-admin-lessons@example.com",
			role: "admin",
		});
		const createdCourse = await createCourseRow(admin.id, {
			isPublished: false,
			publishedAt: null,
		});
		const adminCaller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);

		const firstLesson = await adminCaller.course.adminAddLesson({
			courseId: createdCourse.id,
			title: "Lesson A",
		});
		const secondLesson = await adminCaller.course.adminAddLesson({
			courseId: createdCourse.id,
			title: "Lesson B",
		});

		const updated = await adminCaller.course.adminUpdateLesson({
			id: firstLesson.id,
			patch: {
				title: "Lesson A Updated",
				lessonOrder: 2,
			},
		});
		expect(updated.title).toBe("Lesson A Updated");
		expect(updated.lessonOrder).toBe(2);

		const reordered = await adminCaller.course.adminReorderLessons({
			courseId: createdCourse.id,
			lessonIds: [updated.id, secondLesson.id],
		});
		expect(reordered.map((row) => row.lessonOrder)).toEqual([1, 2]);

		const deleted = await adminCaller.course.adminRemoveLesson({
			id: secondLesson.id,
		});
		expect(deleted.deleted).toBe(true);
	});

	it("maps missing course and lesson errors to NOT_FOUND", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-router-not-found@example.com",
			role: "admin",
		});
		const caller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);

		await expect(
			caller.course.adminGetById({
				id: "00000000-0000-0000-0000-000000000000",
			})
		).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));

		await expect(
			caller.course.adminUpdateLesson({
				id: "00000000-0000-0000-0000-000000000000",
				patch: {
					title: "Missing",
				},
			})
		).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));

		await expect(
			caller.course.adminRemoveLesson({
				id: "00000000-0000-0000-0000-000000000000",
			})
		).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
	});

	it("maps duplicate classification input and invalid reorder payloads to BAD_REQUEST", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-router-bad-request@example.com",
			role: "admin",
		});
		const createdCourse = await createCourseRow(admin.id, {
			isPublished: false,
			publishedAt: null,
		});
		const categoryRows = await testDb.db
			.insert(category)
			.values({
				title: "Education",
				slug: "education",
			})
			.returning();
		const categoryRow = categoryRows[0];
		if (!categoryRow) {
			throw new Error("Failed to create category fixture");
		}

		const caller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);
		const firstLesson = await caller.course.adminAddLesson({
			courseId: createdCourse.id,
			title: "Lesson 1",
		});
		const secondLesson = await caller.course.adminAddLesson({
			courseId: createdCourse.id,
			title: "Lesson 2",
		});

		await expect(
			caller.course.adminSetClassification({
				id: createdCourse.id,
				categoryIds: [categoryRow.id, categoryRow.id],
			})
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));

		await expect(
			caller.course.adminReorderLessons({
				courseId: createdCourse.id,
				lessonIds: [firstLesson.id, firstLesson.id],
			})
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));

		await expect(
			caller.course.adminReorderLessons({
				courseId: createdCourse.id,
				lessonIds: [firstLesson.id],
			})
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));

		expect(secondLesson.id).toBeDefined();
	});

	it("publishing a course with zero lessons maps to BAD_REQUEST", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-router-publish-empty@example.com",
			role: "admin",
		});
		const createdCourse = await createCourseRow(admin.id, {
			isPublished: false,
			publishedAt: null,
		});
		const caller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);

		await expect(
			caller.course.adminSetPublishState({
				id: createdCourse.id,
				isPublished: true,
			})
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
	});
});
