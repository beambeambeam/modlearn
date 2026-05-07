import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "@/lib/db/orm";
import {
	category,
	course,
	courseCategory,
	courseLesson,
	courseLessonView,
	coursePricing,
} from "@/lib/db/schema";
import {
	addLessonToCourse,
	createCourse,
	deleteCourse,
	getCourseById,
	listCourseLessons,
	listCourses,
	listPopularCourses,
	removeLessonFromCourse,
	reorderCourseLessons,
	setCourseAvailability,
	setCourseClassification,
	setCoursePublishState,
	updateCourse,
	updateCourseLesson,
} from "@/modules/course/course.service";
import {
	CategoryNotFoundError,
	CourseLessonNotFoundError,
	CourseNotFoundError,
	CourseReorderValidationError,
	InvalidClassificationInputError,
} from "@/modules/course/course.types";
import { createTestUser } from "../../../__tests__/helpers/factories";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "../../../__tests__/helpers/test-db";

describe("course service", () => {
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

	async function createCategoryRow(
		overrides: Partial<typeof category.$inferInsert> = {}
	) {
		const [row] = await testDb.db
			.insert(category)
			.values({
				title: overrides.title ?? "Category",
				slug: overrides.slug ?? `category-${Date.now()}`,
				description: overrides.description ?? null,
			})
			.returning();

		if (!row) {
			throw new Error("Failed to create category fixture");
		}

		return row;
	}

	async function createCoursePricingRow(
		courseId: string,
		createdBy: string,
		overrides: Partial<typeof coursePricing.$inferInsert> = {}
	) {
		const [row] = await testDb.db
			.insert(coursePricing)
			.values({
				courseId,
				createdBy,
				price: overrides.price ?? "12.50",
				currency: overrides.currency ?? "usd",
				effectiveFrom:
					overrides.effectiveFrom ?? new Date("2025-01-01T00:00:00.000Z"),
				effectiveTo: overrides.effectiveTo ?? null,
			})
			.returning();

		if (!row) {
			throw new Error("Failed to create course pricing fixture");
		}

		return row;
	}

	it("listCourses returns empty result with pagination when no data", async () => {
		const result = await listCourses({
			db: testDb.db,
			input: {},
		});

		expect(result.items).toEqual([]);
		expect(result.pagination).toEqual({
			page: 1,
			limit: 20,
			total: 0,
			totalPages: 0,
		});
	});

	it("getCourseById returns categories array", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-get-by-id-with-classification@example.com",
		});
		const createdCourse = await createCourseRow(admin.id, {
			title: "Classified Course",
		});
		const createdCategory = await createCategoryRow({
			title: "Education",
			slug: "education",
		});

		await setCourseClassification({
			db: testDb.db,
			input: {
				id: createdCourse.id,
				categoryIds: [createdCategory.id],
			},
		});

		const result = await getCourseById({
			db: testDb.db,
			input: {
				id: createdCourse.id,
			},
		});

		expect(result.categories.map((row) => row.id)).toEqual([
			createdCategory.id,
		]);
	});

	it("setCourseClassification replaces categories and supports clearing", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-classification-replace@example.com",
		});
		const createdCourse = await createCourseRow(admin.id, {
			title: "Replace Classification",
		});
		const [firstCategory, secondCategory] = await Promise.all([
			createCategoryRow({ title: "Cat A", slug: "cat-a" }),
			createCategoryRow({ title: "Cat B", slug: "cat-b" }),
		]);

		const first = await setCourseClassification({
			db: testDb.db,
			input: {
				id: createdCourse.id,
				categoryIds: [firstCategory.id, secondCategory.id],
			},
		});
		expect(first.categories.map((row) => row.id)).toEqual([
			firstCategory.id,
			secondCategory.id,
		]);

		const second = await setCourseClassification({
			db: testDb.db,
			input: {
				id: createdCourse.id,
				categoryIds: [],
			},
		});
		expect(second.categories).toHaveLength(0);
	});

	it("setCourseClassification validates duplicate ids and missing category refs", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-classification-validation@example.com",
		});
		const createdCourse = await createCourseRow(admin.id);
		const createdCategory = await createCategoryRow({
			title: "Validation Category",
			slug: "validation-category",
		});

		await expect(
			Promise.resolve().then(() =>
				setCourseClassification({
					db: testDb.db,
					input: {
						id: createdCourse.id,
						categoryIds: [createdCategory.id, createdCategory.id],
					},
				})
			)
		).rejects.toThrow(InvalidClassificationInputError);

		await expect(
			setCourseClassification({
				db: testDb.db,
				input: {
					id: createdCourse.id,
					categoryIds: ["00000000-0000-0000-0000-000000000000"],
				},
			})
		).rejects.toThrow(CategoryNotFoundError);
	});

	it("listCourses supports category filter", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-list-classification-filters@example.com",
		});
		const [catA, catB] = await Promise.all([
			createCategoryRow({ title: "Cat A", slug: "filter-cat-a" }),
			createCategoryRow({ title: "Cat B", slug: "filter-cat-b" }),
		]);
		const courseOne = await createCourseRow(admin.id, { title: "Course One" });
		const courseTwo = await createCourseRow(admin.id, { title: "Course Two" });
		const courseThree = await createCourseRow(admin.id, {
			title: "Course Three",
		});

		await setCourseClassification({
			db: testDb.db,
			input: { id: courseOne.id, categoryIds: [catA.id] },
		});
		await setCourseClassification({
			db: testDb.db,
			input: { id: courseTwo.id, categoryIds: [catB.id] },
		});

		const filtered = await listCourses({
			db: testDb.db,
			input: {
				categoryIds: [catA.id],
			},
		});

		expect(filtered.items.map((row) => row.id)).toEqual([courseOne.id]);
		expect(
			filtered.items.find((row) => row.id === courseThree.id)
		).toBeUndefined();
	});

	it("getCourseById throws when course is not visible in public mode", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-public-visibility@example.com",
		});
		const unpublishedCourse = await createCourseRow(admin.id, {
			title: "Draft",
			isPublished: false,
			publishedAt: null,
		});
		const unavailableCourse = await createCourseRow(admin.id, {
			title: "Unavailable",
			isAvailable: false,
		});
		const deletedCourse = await createCourseRow(admin.id, {
			title: "Deleted",
			isDeleted: true,
			deletedAt: new Date("2025-01-02T00:00:00.000Z"),
		});

		for (const row of [unpublishedCourse, unavailableCourse, deletedCourse]) {
			await expect(
				getCourseById({
					db: testDb.db,
					input: {
						id: row.id,
						onlyPublished: true,
					},
				})
			).rejects.toThrow(CourseNotFoundError);
		}
	});

	it("listCourses includes unpublished and unavailable courses in admin mode", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-admin-list@example.com",
		});
		const publishedCourse = await createCourseRow(admin.id, {
			title: "Published",
		});
		const draftCourse = await createCourseRow(admin.id, {
			title: "Draft",
			isPublished: false,
			publishedAt: null,
		});
		const unavailableCourse = await createCourseRow(admin.id, {
			title: "Unavailable",
			isAvailable: false,
		});
		await createCourseRow(admin.id, {
			title: "Deleted",
			isDeleted: true,
			deletedAt: new Date("2025-01-02T00:00:00.000Z"),
		});

		const result = await listCourses({
			db: testDb.db,
			input: {
				onlyPublished: false,
			},
		});

		expect(result.items.map((row) => row.id).sort()).toEqual(
			[publishedCourse.id, draftCourse.id, unavailableCourse.id].sort()
		);
	});

	it("getCourseById returns draft course in admin mode", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-admin-get-draft@example.com",
		});
		const draftCourse = await createCourseRow(admin.id, {
			title: "Admin Draft",
			isPublished: false,
			publishedAt: null,
		});

		const result = await getCourseById({
			db: testDb.db,
			input: {
				id: draftCourse.id,
				onlyPublished: false,
			},
		});

		expect(result.id).toBe(draftCourse.id);
		expect(result.isPublished).toBe(false);
	});

	it("listCourses supports pagination and search", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-list-pagination-search@example.com",
		});
		await createCourseRow(admin.id, { title: "Season Alpha" });
		await createCourseRow(admin.id, { title: "Season Beta" });
		await createCourseRow(admin.id, { title: "Movie Bundle" });

		const filtered = await listCourses({
			db: testDb.db,
			input: {
				search: "season",
				page: 1,
				limit: 10,
			},
		});

		expect(filtered.items).toHaveLength(2);
		expect(filtered.pagination.total).toBe(2);

		const paged = await listCourses({
			db: testDb.db,
			input: {
				page: 2,
				limit: 2,
			},
		});

		expect(paged.items).toHaveLength(1);
		expect(paged.pagination.total).toBe(3);
		expect(paged.pagination.totalPages).toBe(2);
	});

	it("course visibility filters public and admin results", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-visibility-filters@example.com",
		});
		const publicCourse = await createCourseRow(admin.id, {
			title: "Public Course",
		});
		const draftCourse = await createCourseRow(admin.id, {
			title: "Draft Course",
			isPublished: false,
			publishedAt: null,
		});
		const unavailableCourse = await createCourseRow(admin.id, {
			title: "Unavailable Course",
			isAvailable: false,
		});

		const publicResult = await listCourses({
			db: testDb.db,
			input: {
				onlyPublished: true,
			},
		});
		expect(publicResult.items.map((row) => row.id)).toEqual([publicCourse.id]);

		const adminResult = await listCourses({
			db: testDb.db,
			input: {
				onlyPublished: false,
			},
		});
		expect(adminResult.items.map((row) => row.id).sort()).toEqual(
			[publicCourse.id, draftCourse.id, unavailableCourse.id].sort()
		);
	});

	it("getCourseById returns ordered visible lessons", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-get-with-lessons@example.com",
		});
		const createdCourse = await createCourseRow(admin.id, {
			title: "Series A",
		});

		await createLessonRow(createdCourse.id, {
			title: "Lesson B",
			lessonOrder: 2,
		});
		await createLessonRow(createdCourse.id, {
			title: "Lesson A",
			lessonOrder: 1,
		});
		await createLessonRow(createdCourse.id, {
			title: "Lesson C",
			lessonOrder: 3,
		});

		const result = await getCourseById({
			db: testDb.db,
			input: {
				id: createdCourse.id,
				onlyPublished: true,
			},
		});

		expect(result.lessons.map((lesson) => lesson.title)).toEqual([
			"Lesson A",
			"Lesson B",
			"Lesson C",
		]);
	});

	it("getCourseById throws when course does not exist", async () => {
		await expect(
			getCourseById({
				db: testDb.db,
				input: {
					id: "00000000-0000-0000-0000-000000000000",
					onlyPublished: true,
				},
			})
		).rejects.toThrow(CourseNotFoundError);
	});

	it("listCourseLessons returns lessons in order", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-list-lessons@example.com",
		});
		const createdCourse = await createCourseRow(admin.id);
		await createLessonRow(createdCourse.id, {
			title: "Lesson 2",
			lessonOrder: 2,
		});
		await createLessonRow(createdCourse.id, {
			title: "Lesson 1",
			lessonOrder: 1,
		});

		const result = await listCourseLessons({
			db: testDb.db,
			input: {
				courseId: createdCourse.id,
			},
			onlyPublished: true,
		});

		expect(result.map((lesson) => lesson.lessonOrder)).toEqual([1, 2]);
	});

	it("createCourse creates row with creatorId", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-create@example.com",
		});

		const created = await createCourse({
			db: testDb.db,
			input: {
				title: "Created Course",
			},
			creatorId: admin.id,
		});

		expect(created.creatorId).toBe(admin.id);
		expect(created.title).toBe("Created Course");
	});

	it("setCoursePublishState and setCourseAvailability update visibility state", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-visibility-mutations@example.com",
		});
		const createdCourse = await createCourse({
			db: testDb.db,
			input: { title: "Draft Course" },
			creatorId: admin.id,
		});

		await expect(
			setCoursePublishState({
				db: testDb.db,
				input: {
					id: createdCourse.id,
					isPublished: true,
				},
			})
		).rejects.toThrow(CourseReorderValidationError);

		await addLessonToCourse({
			db: testDb.db,
			input: {
				courseId: createdCourse.id,
				title: "Lesson 1",
			},
		});

		const published = await setCoursePublishState({
			db: testDb.db,
			input: {
				id: createdCourse.id,
				isPublished: true,
			},
		});
		expect(published.isPublished).toBe(true);
		expect(published.publishedAt).toBeInstanceOf(Date);

		const unavailable = await setCourseAvailability({
			db: testDb.db,
			input: {
				id: createdCourse.id,
				isAvailable: false,
			},
		});
		expect(unavailable.isAvailable).toBe(false);
	});

	it("updateCourse applies patch and throws when course is missing", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-update@example.com",
		});
		const createdCourse = await createCourseRow(admin.id, {
			title: "First",
			description: "Desc",
		});

		const updated = await updateCourse({
			db: testDb.db,
			input: {
				id: createdCourse.id,
				patch: {
					title: "First Updated",
				},
			},
		});
		expect(updated.title).toBe("First Updated");
		expect(updated.description).toBe("Desc");

		await expect(
			updateCourse({
				db: testDb.db,
				input: {
					id: "00000000-0000-0000-0000-000000000000",
					patch: {
						title: "Missing",
					},
				},
			})
		).rejects.toThrow(CourseNotFoundError);
	});

	it("deleteCourse soft-deletes and hides the row", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-delete@example.com",
		});
		const createdCourse = await createCourseRow(admin.id);

		const deleted = await deleteCourse({
			db: testDb.db,
			input: { id: createdCourse.id },
		});
		expect(deleted.id).toBe(createdCourse.id);
		expect(deleted.deleted).toBe(true);
		expect(deleted.deletedAt).toBeInstanceOf(Date);

		const row = await testDb.db.query.course.findFirst({
			where: eq(course.id, createdCourse.id),
		});
		expect(row?.isDeleted).toBe(true);
		expect(row?.deletedAt).toBeInstanceOf(Date);

		await expect(
			getCourseById({
				db: testDb.db,
				input: { id: createdCourse.id, onlyPublished: true },
			})
		).rejects.toThrow(CourseNotFoundError);
	});

	it("addLessonToCourse appends when no order is provided", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-add-lesson-append@example.com",
		});
		const createdCourse = await createCourseRow(admin.id);
		await createLessonRow(createdCourse.id, { lessonOrder: 1, title: "First" });

		const created = await addLessonToCourse({
			db: testDb.db,
			input: {
				courseId: createdCourse.id,
				title: "Second",
			},
		});

		expect(created.lessonOrder).toBe(2);
	});

	it("addLessonToCourse inserts and shifts when order is provided", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-add-lesson-insert@example.com",
		});
		const createdCourse = await createCourseRow(admin.id);
		const first = await createLessonRow(createdCourse.id, {
			lessonOrder: 1,
			title: "First",
		});
		const second = await createLessonRow(createdCourse.id, {
			lessonOrder: 2,
			title: "Second",
		});

		const inserted = await addLessonToCourse({
			db: testDb.db,
			input: {
				courseId: createdCourse.id,
				title: "Inserted",
				lessonOrder: 2,
			},
		});

		const rows = await listCourseLessons({
			db: testDb.db,
			input: { courseId: createdCourse.id },
			onlyPublished: false,
		});
		expect(inserted.lessonOrder).toBe(2);
		expect(
			rows.map((row) => ({ id: row.id, lessonOrder: row.lessonOrder }))
		).toEqual([
			{ id: first.id, lessonOrder: 1 },
			{ id: inserted.id, lessonOrder: 2 },
			{ id: second.id, lessonOrder: 3 },
		]);
	});

	it("addLessonToCourse throws for missing course", async () => {
		await expect(
			addLessonToCourse({
				db: testDb.db,
				input: {
					courseId: "00000000-0000-0000-0000-000000000000",
					title: "Missing",
				},
			})
		).rejects.toThrow(CourseNotFoundError);
	});

	it("updateCourseLesson updates metadata fields", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-update-lesson-fields@example.com",
		});
		const createdCourse = await createCourseRow(admin.id);
		const lesson = await createLessonRow(createdCourse.id, {
			title: "Before",
			description: "Before Desc",
		});

		const updated = await updateCourseLesson({
			db: testDb.db,
			input: {
				id: lesson.id,
				patch: {
					title: "After",
					description: "After Desc",
					duration: 2000,
					releaseDate: "2025-02-01",
					thumbnailImageId: null,
					fileId: null,
				},
			},
		});

		expect(updated.title).toBe("After");
		expect(updated.description).toBe("After Desc");
		expect(updated.duration).toBe(2000);
		expect(updated.releaseDate).toEqual(new Date("2025-02-01T00:00:00.000Z"));
	});

	it("updateCourseLesson reorders lessons", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-update-lesson-reorder@example.com",
		});
		const createdCourse = await createCourseRow(admin.id);
		const first = await createLessonRow(createdCourse.id, {
			title: "First",
			lessonOrder: 1,
		});
		const second = await createLessonRow(createdCourse.id, {
			title: "Second",
			lessonOrder: 2,
		});
		const third = await createLessonRow(createdCourse.id, {
			title: "Third",
			lessonOrder: 3,
		});

		await updateCourseLesson({
			db: testDb.db,
			input: {
				id: third.id,
				patch: {
					lessonOrder: 1,
				},
			},
		});

		const rows = await listCourseLessons({
			db: testDb.db,
			input: { courseId: createdCourse.id },
			onlyPublished: false,
		});
		expect(
			rows.map((row) => ({ id: row.id, lessonOrder: row.lessonOrder }))
		).toEqual([
			{ id: third.id, lessonOrder: 1 },
			{ id: first.id, lessonOrder: 2 },
			{ id: second.id, lessonOrder: 3 },
		]);
	});

	it("updateCourseLesson throws when lesson is missing", async () => {
		await expect(
			updateCourseLesson({
				db: testDb.db,
				input: {
					id: "00000000-0000-0000-0000-000000000000",
					patch: { title: "Missing" },
				},
			})
		).rejects.toThrow(CourseLessonNotFoundError);
	});

	it("removeLessonFromCourse deletes and compacts order", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-remove-lesson@example.com",
		});
		const createdCourse = await createCourseRow(admin.id);
		const first = await createLessonRow(createdCourse.id, { lessonOrder: 1 });
		const middle = await createLessonRow(createdCourse.id, { lessonOrder: 2 });
		const last = await createLessonRow(createdCourse.id, { lessonOrder: 3 });

		const deleted = await removeLessonFromCourse({
			db: testDb.db,
			input: { id: middle.id },
		});
		expect(deleted).toEqual({
			id: middle.id,
			courseId: createdCourse.id,
			deleted: true,
		});

		const rows = await listCourseLessons({
			db: testDb.db,
			input: { courseId: createdCourse.id },
			onlyPublished: false,
		});
		expect(
			rows.map((row) => ({ id: row.id, lessonOrder: row.lessonOrder }))
		).toEqual([
			{ id: first.id, lessonOrder: 1 },
			{ id: last.id, lessonOrder: 2 },
		]);
	});

	it("reorderCourseLessons rewrites order to 1..N", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-reorder-lessons@example.com",
		});
		const createdCourse = await createCourseRow(admin.id);
		const first = await createLessonRow(createdCourse.id, { lessonOrder: 1 });
		const second = await createLessonRow(createdCourse.id, { lessonOrder: 2 });
		const third = await createLessonRow(createdCourse.id, { lessonOrder: 3 });

		const reordered = await reorderCourseLessons({
			db: testDb.db,
			input: {
				courseId: createdCourse.id,
				lessonIds: [third.id, first.id, second.id],
			},
		});

		expect(
			reordered.map((row) => ({ id: row.id, lessonOrder: row.lessonOrder }))
		).toEqual([
			{ id: third.id, lessonOrder: 1 },
			{ id: first.id, lessonOrder: 2 },
			{ id: second.id, lessonOrder: 3 },
		]);
	});

	it("reorderCourseLessons validates exact set and duplicates", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-reorder-lessons-invalid@example.com",
		});
		const createdCourse = await createCourseRow(admin.id);
		const first = await createLessonRow(createdCourse.id, { lessonOrder: 1 });
		const second = await createLessonRow(createdCourse.id, { lessonOrder: 2 });

		await expect(
			reorderCourseLessons({
				db: testDb.db,
				input: {
					courseId: createdCourse.id,
					lessonIds: [first.id, first.id],
				},
			})
		).rejects.toThrow(CourseReorderValidationError);

		await expect(
			reorderCourseLessons({
				db: testDb.db,
				input: {
					courseId: createdCourse.id,
					lessonIds: [first.id],
				},
			})
		).rejects.toThrow(CourseReorderValidationError);

		await expect(
			reorderCourseLessons({
				db: testDb.db,
				input: {
					courseId: createdCourse.id,
					lessonIds: [first.id, "00000000-0000-0000-0000-000000000000"],
				},
			})
		).rejects.toThrow(CourseReorderValidationError);

		expect(second.id).toBeDefined();
	});

	it("listPopularCourses orders by aggregated lesson views", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-popular@example.com",
		});
		const firstCourse = await createCourseRow(admin.id, { title: "Course A" });
		const secondCourse = await createCourseRow(admin.id, { title: "Course B" });
		const firstLesson = await createLessonRow(firstCourse.id, {
			lessonOrder: 1,
		});
		const secondLesson = await createLessonRow(secondCourse.id, {
			lessonOrder: 1,
		});

		await testDb.db.insert(courseLessonView).values([
			{ courseLessonId: secondLesson.id, watchDuration: 100 },
			{ courseLessonId: secondLesson.id, watchDuration: 200 },
			{ courseLessonId: firstLesson.id, watchDuration: 50 },
		]);

		const result = await listPopularCourses({
			db: testDb.db,
			input: { limit: 10 },
		});

		expect(result[0]?.id).toBe(secondCourse.id);
		expect(result[1]?.id).toBe(firstCourse.id);
	});

	it("getCourseById and listCourses resolve activePricing", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-active-pricing@example.com",
		});
		const pricedCourse = await createCourseRow(admin.id, {
			title: "Priced Course",
		});
		const noPriceCourse = await createCourseRow(admin.id, {
			title: "No Price Course",
		});
		await createCoursePricingRow(pricedCourse.id, admin.id);

		const listResult = await listCourses({
			db: testDb.db,
			input: {},
		});
		const pricedFromList = listResult.items.find(
			(item) => item.id === pricedCourse.id
		);
		const noPriceFromList = listResult.items.find(
			(item) => item.id === noPriceCourse.id
		);
		expect(pricedFromList?.activePricing).toEqual({
			price: "12.50",
			currency: "USD",
		});
		expect(noPriceFromList?.activePricing).toBeNull();

		const detailResult = await getCourseById({
			db: testDb.db,
			input: {
				id: pricedCourse.id,
			},
		});
		expect(detailResult.activePricing).toEqual({
			price: "12.50",
			currency: "USD",
		});
	});

	it("setCourseClassification replaces rows in course_category", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "course-category-rows@example.com",
		});
		const createdCourse = await createCourseRow(admin.id);
		const createdCategory = await createCategoryRow({
			title: "Rows",
			slug: "rows",
		});

		await setCourseClassification({
			db: testDb.db,
			input: {
				id: createdCourse.id,
				categoryIds: [createdCategory.id],
			},
		});

		const rows = await testDb.db
			.select()
			.from(courseCategory)
			.where(eq(courseCategory.courseId, createdCourse.id));
		expect(rows).toHaveLength(1);
		expect(rows[0]?.categoryId).toBe(createdCategory.id);
	});
});
