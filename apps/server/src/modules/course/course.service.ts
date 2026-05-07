import {
	and,
	asc,
	count,
	desc,
	eq,
	exists,
	gt,
	ilike,
	inArray,
	isNull,
	lte,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import type { DbClient } from "@/lib/db/orm";
import {
	category,
	course,
	courseCategory,
	courseLesson,
	courseLessonView,
	coursePricing,
} from "@/lib/db/schema";
import type {
	ActivePricing,
	AddLessonToCourseParams,
	CourseClassificationResult,
	CourseDetailResult,
	CourseLessonView as CourseLessonViewType,
	CourseWithActivePricing,
	CreateCourseParams,
	DeleteCourseParams,
	DeleteCourseResult,
	GetCourseByIdParams,
	LessonDeleteResult,
	ListCourseLessonsParams,
	ListCoursesParams,
	ListCoursesResult,
	ListPopularCoursesParams,
	ReorderCourseLessonsParams,
	RemoveLessonFromCourseParams,
	SetCourseAvailabilityParams,
	SetCourseClassificationParams,
	SetCoursePublishStateParams,
	UpdateCourseLessonParams,
	UpdateCourseParams,
} from "./course.types";
import {
	CategoryNotFoundError,
	CourseLessonNotFoundError,
	CourseNotFoundError,
	CourseReorderValidationError,
	InvalidClassificationInputError,
} from "./course.types";
import { hasDuplicates, normalizeString, toReleaseDate } from "./course.utils";

function toPagination(params: { page: number; limit: number; total: number }) {
	const { page, limit, total } = params;
	return {
		page,
		limit,
		total,
		totalPages: total === 0 ? 0 : Math.ceil(total / limit),
	};
}

async function ensureCourseExists(db: DbClient, courseId: string): Promise<void> {
	const row = await db.query.course.findFirst({
		where: and(eq(course.id, courseId), eq(course.isDeleted, false)),
		columns: { id: true },
	});

	if (!row) {
		throw new CourseNotFoundError();
	}
}

async function ensureCategoriesExist(
	db: DbClient,
	ids: string[]
): Promise<void> {
	if (ids.length === 0) {
		return;
	}

	const rows = await db
		.select({ id: category.id })
		.from(category)
		.where(inArray(category.id, ids));
	if (rows.length !== ids.length) {
		throw new CategoryNotFoundError();
	}
}

function buildCourseFilters(
	db: DbClient,
	input: {
		id?: string;
		search?: string;
		onlyPublished?: boolean;
		categoryIds?: string[];
	}
): SQL<unknown> | undefined {
	const conditions: SQL<unknown>[] = [eq(course.isDeleted, false)];

	if (input.id) {
		conditions.push(eq(course.id, input.id));
	}

	if (input.onlyPublished ?? true) {
		conditions.push(eq(course.isPublished, true));
		conditions.push(eq(course.isAvailable, true));
	}

	const search = normalizeString(input.search);
	if (search) {
		conditions.push(ilike(course.title, `%${search}%`));
	}

	if (input.categoryIds && input.categoryIds.length > 0) {
		conditions.push(
			exists(
				db
					.select({ id: courseCategory.id })
					.from(courseCategory)
					.where(
						and(
							eq(courseCategory.courseId, course.id),
							inArray(courseCategory.categoryId, input.categoryIds)
						)
					)
			)
		);
	}

	return and(...conditions);
}

async function resolveActivePricing(params: {
	db: DbClient;
	courseId: string;
	now?: Date;
}): Promise<ActivePricing | null> {
	const { db, courseId, now = new Date() } = params;
	const row = await db.query.coursePricing.findFirst({
		where: and(
			eq(coursePricing.courseId, courseId),
			lte(coursePricing.effectiveFrom, now),
			or(isNull(coursePricing.effectiveTo), gt(coursePricing.effectiveTo, now))
		),
		orderBy: [desc(coursePricing.effectiveFrom), desc(coursePricing.createdAt)],
		columns: {
			price: true,
			currency: true,
		},
	});

	if (!row) {
		return null;
	}

	return {
		price: row.price,
		currency: row.currency.toUpperCase(),
	};
}

async function getCourseLessons(params: {
	db: DbClient;
	courseId: string;
}): Promise<CourseLessonViewType[]> {
	const { db, courseId } = params;
	return db
		.select()
		.from(courseLesson)
		.where(eq(courseLesson.courseId, courseId))
		.orderBy(
			asc(courseLesson.lessonOrder),
			asc(courseLesson.addedAt),
			asc(courseLesson.id)
		);
}

async function getCourseClassification(params: {
	db: DbClient;
	courseId: string;
}): Promise<CourseClassificationResult> {
	const { db, courseId } = params;
	const categoryRows = await db
		.select({
			id: category.id,
			title: category.title,
			slug: category.slug,
			description: category.description,
		})
		.from(courseCategory)
		.innerJoin(category, eq(courseCategory.categoryId, category.id))
		.where(eq(courseCategory.courseId, courseId))
		.orderBy(asc(category.title), asc(category.id));

	return {
		courseId,
		categories: categoryRows,
	};
}

async function compactLessonOrder(
	db: DbClient,
	courseId: string
): Promise<void> {
	const rows = await db
		.select({ id: courseLesson.id })
		.from(courseLesson)
		.where(eq(courseLesson.courseId, courseId))
		.orderBy(asc(courseLesson.lessonOrder), asc(courseLesson.addedAt), asc(courseLesson.id));

	for (const [index, row] of rows.entries()) {
		await db
			.update(courseLesson)
			.set({ lessonOrder: index + 1 })
			.where(eq(courseLesson.id, row.id));
	}
}

async function getCourseLessonOrThrow(
	db: DbClient,
	lessonId: string
): Promise<typeof courseLesson.$inferSelect> {
	const row = await db.query.courseLesson.findFirst({
		where: eq(courseLesson.id, lessonId),
	});
	if (!row) {
		throw new CourseLessonNotFoundError();
	}
	return row;
}

export async function listCourses(
	params: ListCoursesParams
): Promise<ListCoursesResult> {
	const { db, input } = params;
	const page = input.page ?? 1;
	const limit = input.limit ?? 20;
	const offset = (page - 1) * limit;
	const filters = buildCourseFilters(db, {
		search: input.search,
		onlyPublished: input.onlyPublished ?? true,
		categoryIds: input.categoryIds,
	});

	const countRows = await db
		.select({ total: count() })
		.from(course)
		.where(filters);
	const total = Number(countRows[0]?.total ?? 0);

	const sortBy = input.sortBy ?? "RECENTLY_ADDED";
	const orderByClause =
		sortBy === "RECENTLY_PUBLISHED"
			? [sql`${course.publishedAt} DESC NULLS LAST`, desc(course.createdAt)]
			: [desc(course.createdAt), desc(course.id)];

	const items = await db
		.select()
		.from(course)
		.where(filters)
		.orderBy(...orderByClause)
		.limit(limit)
		.offset(offset);

	const itemsWithPricing: CourseWithActivePricing[] = await Promise.all(
		items.map(async (item) => ({
			...item,
			activePricing: await resolveActivePricing({
				db,
				courseId: item.id,
			}),
		}))
	);

	return {
		items: itemsWithPricing,
		pagination: toPagination({ page, limit, total }),
	};
}

export async function getCourseById(
	params: GetCourseByIdParams
): Promise<CourseDetailResult> {
	const { db, input } = params;
	const row = await db.query.course.findFirst({
		where: buildCourseFilters(db, {
			id: input.id,
			onlyPublished: input.onlyPublished ?? true,
		}),
	});

	if (!row) {
		throw new CourseNotFoundError();
	}

	const [classification, activePricing, lessons] = await Promise.all([
		getCourseClassification({ db, courseId: row.id }),
		resolveActivePricing({ db, courseId: row.id }),
		getCourseLessons({ db, courseId: row.id }),
	]);

	return {
		...row,
		activePricing,
		categories: classification.categories,
		lessons,
	};
}

export async function listPopularCourses(
	params: ListPopularCoursesParams
): Promise<CourseWithActivePricing[]> {
	const { db, input } = params;
	const limit = input.limit ?? 10;
	const filters = buildCourseFilters(db, {
		onlyPublished: true,
	});

	const rows = await db
		.select({
			item: course,
			viewCount: count(courseLessonView.id),
		})
		.from(course)
		.leftJoin(courseLesson, eq(courseLesson.courseId, course.id))
		.leftJoin(courseLessonView, eq(courseLessonView.courseLessonId, courseLesson.id))
		.where(filters)
		.groupBy(course.id)
		.orderBy(desc(count(courseLessonView.id)), desc(course.createdAt), desc(course.id))
		.limit(limit);

	return Promise.all(
		rows.map(async ({ item }) => ({
			...item,
			activePricing: await resolveActivePricing({
				db,
				courseId: item.id,
			}),
		}))
	);
}

export async function createCourse(
	params: CreateCourseParams
): Promise<typeof course.$inferSelect> {
	const { db, input, creatorId } = params;
	const [created] = await db
		.insert(course)
		.values({
			creatorId,
			title: input.title,
			description: input.description ?? null,
			thumbnailImageId: input.thumbnailImageId ?? null,
			isPublished: false,
			publishedAt: null,
			isAvailable: true,
			isDeleted: false,
			deletedAt: null,
		})
		.returning();

	if (!created) {
		throw new Error("Failed to create course");
	}

	return created;
}

export async function updateCourse(
	params: UpdateCourseParams
): Promise<typeof course.$inferSelect> {
	const { db, input } = params;
	const [updated] = await db
		.update(course)
		.set({
			title: input.patch.title,
			description: input.patch.description,
			thumbnailImageId: input.patch.thumbnailImageId,
		})
		.where(and(eq(course.id, input.id), eq(course.isDeleted, false)))
		.returning();

	if (!updated) {
		throw new CourseNotFoundError();
	}

	return updated;
}

export async function setCoursePublishState(
	params: SetCoursePublishStateParams
): Promise<typeof course.$inferSelect> {
	const { db, input } = params;
	const existing = await db.query.course.findFirst({
		where: and(eq(course.id, input.id), eq(course.isDeleted, false)),
	});

	if (!existing) {
		throw new CourseNotFoundError();
	}

	if (input.isPublished) {
		const lessonCountRows = await db
			.select({ total: count() })
			.from(courseLesson)
			.where(eq(courseLesson.courseId, input.id));
		if (Number(lessonCountRows[0]?.total ?? 0) === 0) {
			throw new CourseReorderValidationError(
				"Course must have at least one lesson before publishing"
			);
		}
	}

	const [updated] = await db
		.update(course)
		.set({
			isPublished: input.isPublished,
			publishedAt: input.isPublished
				? (existing.publishedAt ?? new Date())
				: null,
		})
		.where(and(eq(course.id, input.id), eq(course.isDeleted, false)))
		.returning();

	if (!updated) {
		throw new CourseNotFoundError();
	}

	return updated;
}

export async function setCourseClassification(
	params: SetCourseClassificationParams
): Promise<CourseClassificationResult> {
	const { db, input } = params;

	if (hasDuplicates(input.categoryIds)) {
		throw new InvalidClassificationInputError(
			"categoryIds contains duplicates"
		);
	}

	return db.transaction(async (tx) => {
		await ensureCourseExists(tx, input.id);

		const normalizedCategoryIds = [...new Set(input.categoryIds)];
		await ensureCategoriesExist(tx, normalizedCategoryIds);

		await tx
			.delete(courseCategory)
			.where(eq(courseCategory.courseId, input.id));

		if (normalizedCategoryIds.length > 0) {
			await tx.insert(courseCategory).values(
				normalizedCategoryIds.map((categoryId) => ({
					courseId: input.id,
					categoryId,
				}))
			);
		}

		return getCourseClassification({
			db: tx,
			courseId: input.id,
		});
	});
}

export async function deleteCourse(
	params: DeleteCourseParams
): Promise<DeleteCourseResult> {
	const { db, input } = params;
	const deletedAt = new Date();
	const [updated] = await db
		.update(course)
		.set({
			isDeleted: true,
			deletedAt,
		})
		.where(and(eq(course.id, input.id), eq(course.isDeleted, false)))
		.returning();

	if (!updated?.deletedAt) {
		throw new CourseNotFoundError();
	}

	return {
		id: updated.id,
		deleted: true,
		deletedAt: updated.deletedAt,
	};
}

export async function setCourseAvailability(
	params: SetCourseAvailabilityParams
): Promise<typeof course.$inferSelect> {
	const { db, input } = params;
	const [updated] = await db
		.update(course)
		.set({
			isAvailable: input.isAvailable,
		})
		.where(and(eq(course.id, input.id), eq(course.isDeleted, false)))
		.returning();

	if (!updated) {
		throw new CourseNotFoundError();
	}

	return updated;
}

export async function listCourseLessons(
	params: ListCourseLessonsParams
): Promise<CourseLessonViewType[]> {
	const { db, input, onlyPublished = true } = params;
	const courseRow = await db.query.course.findFirst({
		where: buildCourseFilters(db, {
			id: input.courseId,
			onlyPublished,
		}),
		columns: { id: true },
	});

	if (!courseRow) {
		throw new CourseNotFoundError();
	}

	return getCourseLessons({
		db,
		courseId: input.courseId,
	});
}

export async function addLessonToCourse(
	params: AddLessonToCourseParams
): Promise<typeof courseLesson.$inferSelect> {
	const { db, input } = params;
	return db.transaction(async (tx) => {
		await ensureCourseExists(tx, input.courseId);

		const countRows = await tx
			.select({ total: count() })
			.from(courseLesson)
			.where(eq(courseLesson.courseId, input.courseId));
		const currentCount = Number(countRows[0]?.total ?? 0);
		const targetOrder = Math.max(
			1,
			Math.min(input.lessonOrder ?? currentCount + 1, currentCount + 1)
		);

		await tx
			.update(courseLesson)
			.set({
				lessonOrder: sql`${courseLesson.lessonOrder} + 1`,
			})
			.where(
				and(
					eq(courseLesson.courseId, input.courseId),
					sql`${courseLesson.lessonOrder} >= ${targetOrder}`
				)
			);

		const [created] = await tx
			.insert(courseLesson)
			.values({
				courseId: input.courseId,
				lessonOrder: targetOrder,
				title: input.title,
				description: input.description ?? null,
				thumbnailImageId: input.thumbnailImageId ?? null,
				duration: input.duration ?? null,
				releaseDate: toReleaseDate(input.releaseDate),
				fileId: input.fileId ?? null,
			})
			.returning();

		if (!created) {
			throw new Error("Failed to add course lesson");
		}

		return created;
	});
}

export async function updateCourseLesson(
	params: UpdateCourseLessonParams
): Promise<typeof courseLesson.$inferSelect> {
	const { db, input } = params;
	return db.transaction(async (tx) => {
		const existing = await getCourseLessonOrThrow(tx, input.id);
		let nextOrder = existing.lessonOrder;

		if (
			input.patch.lessonOrder !== undefined &&
			input.patch.lessonOrder !== existing.lessonOrder
		) {
			const countRows = await tx
				.select({ total: count() })
				.from(courseLesson)
				.where(eq(courseLesson.courseId, existing.courseId));
			const total = Number(countRows[0]?.total ?? 0);
			nextOrder = Math.max(1, Math.min(input.patch.lessonOrder, total));

			if (nextOrder > existing.lessonOrder) {
				await tx
					.update(courseLesson)
					.set({
						lessonOrder: sql`${courseLesson.lessonOrder} - 1`,
					})
					.where(
						and(
							eq(courseLesson.courseId, existing.courseId),
							sql`${courseLesson.lessonOrder} > ${existing.lessonOrder}`,
							sql`${courseLesson.lessonOrder} <= ${nextOrder}`
						)
					);
			} else {
				await tx
					.update(courseLesson)
					.set({
						lessonOrder: sql`${courseLesson.lessonOrder} + 1`,
					})
					.where(
						and(
							eq(courseLesson.courseId, existing.courseId),
							sql`${courseLesson.lessonOrder} >= ${nextOrder}`,
							sql`${courseLesson.lessonOrder} < ${existing.lessonOrder}`
						)
					);
			}
		}

		const [updated] = await tx
			.update(courseLesson)
			.set({
				title: input.patch.title ?? existing.title,
				description:
					input.patch.description === undefined
						? existing.description
						: input.patch.description,
				thumbnailImageId:
					input.patch.thumbnailImageId === undefined
						? existing.thumbnailImageId
						: input.patch.thumbnailImageId,
				duration:
					input.patch.duration === undefined
						? existing.duration
						: input.patch.duration,
				releaseDate:
					input.patch.releaseDate === undefined
						? existing.releaseDate
						: toReleaseDate(input.patch.releaseDate),
				fileId:
					input.patch.fileId === undefined ? existing.fileId : input.patch.fileId,
				lessonOrder: nextOrder,
			})
			.where(eq(courseLesson.id, input.id))
			.returning();

		if (!updated) {
			throw new CourseLessonNotFoundError();
		}

		return updated;
	});
}

export async function removeLessonFromCourse(
	params: RemoveLessonFromCourseParams
): Promise<LessonDeleteResult> {
	const { db, input } = params;
	return db.transaction(async (tx) => {
		const existing = await getCourseLessonOrThrow(tx, input.id);

		await tx.delete(courseLesson).where(eq(courseLesson.id, input.id));
		await compactLessonOrder(tx, existing.courseId);

		return {
			id: existing.id,
			courseId: existing.courseId,
			deleted: true,
		};
	});
}

export async function reorderCourseLessons(
	params: ReorderCourseLessonsParams
): Promise<CourseLessonViewType[]> {
	const { db, input } = params;
	return db.transaction(async (tx) => {
		await ensureCourseExists(tx, input.courseId);

		const existingRows = await tx
			.select({ id: courseLesson.id })
			.from(courseLesson)
			.where(eq(courseLesson.courseId, input.courseId))
			.orderBy(asc(courseLesson.lessonOrder), asc(courseLesson.id));

		if (existingRows.length !== input.lessonIds.length) {
			throw new CourseReorderValidationError(
				"Lesson IDs must match course lesson set exactly"
			);
		}

		const existingIdSet = new Set(existingRows.map((row) => row.id));
		if (hasDuplicates(input.lessonIds)) {
			throw new CourseReorderValidationError("Lesson IDs must be unique");
		}
		for (const lessonId of input.lessonIds) {
			if (!existingIdSet.has(lessonId)) {
				throw new CourseReorderValidationError(
					"Lesson IDs must match course lesson set exactly"
				);
			}
		}

		for (const [index, lessonId] of input.lessonIds.entries()) {
			await tx
				.update(courseLesson)
				.set({ lessonOrder: index + 1 })
				.where(eq(courseLesson.id, lessonId));
		}

		return getCourseLessons({
			db: tx,
			courseId: input.courseId,
		});
	});
}
