import { and, asc, desc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import type { DbClient } from "@/lib/db/orm";
import { course, courseLesson, userLibrary } from "@/lib/db/schema";
import type {
	GetMyCourseParams,
	HasLibraryAccessParams,
	LibraryCourseItem,
	LibraryCourseLessonSummary,
	LibraryHasAccessResult,
	LibraryListMyItemsResult,
	ListMyLibraryItemsParams,
} from "./library.types";
import {
	LibraryAccessDeniedError,
	LibraryCourseNotFoundError,
} from "./library.types";

function activeEntitlementCondition(userId: string, now: Date) {
	return and(
		eq(userLibrary.userId, userId),
		or(isNull(userLibrary.expiresAt), gt(userLibrary.expiresAt, now))
	);
}

function toPaging(input: { page?: number; limit?: number }) {
	const page = input.page ?? 1;
	const limit = input.limit ?? 20;
	const offset = (page - 1) * limit;
	return { page, limit, offset };
}

function listActiveEntitlements(
	db: DbClient,
	userId: string,
	now = new Date()
) {
	return db
		.select({
			id: userLibrary.id,
			courseId: userLibrary.courseId,
			orderId: userLibrary.orderId,
			acquiredAt: userLibrary.acquiredAt,
			expiresAt: userLibrary.expiresAt,
		})
		.from(userLibrary)
		.where(activeEntitlementCondition(userId, now))
		.orderBy(desc(userLibrary.acquiredAt), desc(userLibrary.id));
}

async function getCourseSummaryMap(db: DbClient, courseIds: string[]) {
	if (courseIds.length === 0) {
		return new Map();
	}

	const rows = await db
		.select({
			id: course.id,
			creatorId: course.creatorId,
			title: course.title,
			description: course.description,
			thumbnailImageId: course.thumbnailImageId,
			isPublished: course.isPublished,
			publishedAt: course.publishedAt,
			isAvailable: course.isAvailable,
			isDeleted: course.isDeleted,
			deletedAt: course.deletedAt,
			createdAt: course.createdAt,
			updatedAt: course.updatedAt,
		})
		.from(course)
		.where(inArray(course.id, courseIds));

	return new Map(rows.map((row) => [row.id, row]));
}

async function listCourseLessons(
	db: DbClient,
	courseIds: string[]
): Promise<LibraryCourseLessonSummary[]> {
	if (courseIds.length === 0) {
		return [];
	}

	return db
		.select({
			id: courseLesson.id,
			courseId: courseLesson.courseId,
			lessonOrder: courseLesson.lessonOrder,
			title: courseLesson.title,
			description: courseLesson.description,
			thumbnailImageId: courseLesson.thumbnailImageId,
			duration: courseLesson.duration,
			releaseDate: courseLesson.releaseDate,
			fileId: courseLesson.fileId,
			addedAt: courseLesson.addedAt,
			createdAt: courseLesson.createdAt,
			updatedAt: courseLesson.updatedAt,
		})
		.from(courseLesson)
		.where(inArray(courseLesson.courseId, courseIds))
		.orderBy(
			asc(courseLesson.courseId),
			asc(courseLesson.lessonOrder),
			asc(courseLesson.addedAt),
			asc(courseLesson.id)
		);
}

export async function listMyLibraryItems(
	params: ListMyLibraryItemsParams
): Promise<LibraryListMyItemsResult> {
	const { db, userId, input } = params;
	const { page, limit, offset } = toPaging(input);
	const entitlements = await listActiveEntitlements(db, userId);

	const entitlementByCourseId = new Map<
		string,
		(typeof entitlements)[number]
	>();
	for (const row of entitlements) {
		if (!entitlementByCourseId.has(row.courseId)) {
			entitlementByCourseId.set(row.courseId, row);
		}
	}

	const courseIds = Array.from(entitlementByCourseId.keys());
	const courseSummaryById = await getCourseSummaryMap(db, courseIds);
	const lessons = await listCourseLessons(db, courseIds);
	const lessonsByCourseId = new Map<string, LibraryCourseLessonSummary[]>();

	for (const lesson of lessons) {
		const current = lessonsByCourseId.get(lesson.courseId) ?? [];
		current.push(lesson);
		lessonsByCourseId.set(lesson.courseId, current);
	}

	const items: LibraryCourseItem[] = [];
	for (const [courseId, entitlement] of entitlementByCourseId.entries()) {
		const courseSummary = courseSummaryById.get(courseId);
		if (!courseSummary) {
			continue;
		}

		items.push({
			type: "COURSE",
			acquiredAt: entitlement.acquiredAt,
			expiresAt: entitlement.expiresAt,
			orderId: entitlement.orderId,
			course: courseSummary,
			lessons: lessonsByCourseId.get(courseId) ?? [],
		});
	}

	items.sort((a, b) => {
		const byAcquiredAt = b.acquiredAt.getTime() - a.acquiredAt.getTime();
		if (byAcquiredAt !== 0) {
			return byAcquiredAt;
		}

		return a.course.id.localeCompare(b.course.id);
	});

	const total = items.length;
	return {
		items: items.slice(offset, offset + limit),
		pagination: {
			page,
			limit,
			total,
			totalPages: total === 0 ? 0 : Math.ceil(total / limit),
		},
	};
}

export async function getMyCourse(
	params: GetMyCourseParams
): Promise<LibraryCourseItem> {
	const { db, userId, input } = params;
	const courseRow = await db.query.course.findFirst({
		where: eq(course.id, input.courseId),
		columns: { id: true },
	});

	if (!courseRow) {
		throw new LibraryCourseNotFoundError();
	}

	const entitlement = await db.query.userLibrary.findFirst({
		where: and(
			eq(userLibrary.userId, userId),
			eq(userLibrary.courseId, input.courseId),
			or(isNull(userLibrary.expiresAt), gt(userLibrary.expiresAt, new Date()))
		),
		columns: {
			orderId: true,
			acquiredAt: true,
			expiresAt: true,
		},
	});

	if (!entitlement) {
		throw new LibraryAccessDeniedError();
	}

	const courseSummaryById = await getCourseSummaryMap(db, [input.courseId]);
	const summary = courseSummaryById.get(input.courseId);
	if (!summary) {
		throw new LibraryCourseNotFoundError();
	}

	return {
		type: "COURSE",
		acquiredAt: entitlement.acquiredAt,
		expiresAt: entitlement.expiresAt,
		orderId: entitlement.orderId,
		course: summary,
		lessons: await listCourseLessons(db, [input.courseId]),
	};
}

export async function hasLibraryAccess(
	params: HasLibraryAccessParams
): Promise<LibraryHasAccessResult> {
	const { db, userId, input } = params;

	if (input.courseId) {
		const row = await db.query.userLibrary.findFirst({
			where: and(
				eq(userLibrary.userId, userId),
				eq(userLibrary.courseId, input.courseId),
				or(isNull(userLibrary.expiresAt), gt(userLibrary.expiresAt, new Date()))
			),
			columns: { id: true },
		});

		return { hasAccess: Boolean(row) };
	}

	if (!input.courseLessonId) {
		return { hasAccess: false };
	}

	const lessonRow = await db.query.courseLesson.findFirst({
		where: eq(courseLesson.id, input.courseLessonId),
		columns: { courseId: true },
	});

	if (!lessonRow) {
		return { hasAccess: false };
	}

	const row = await db.query.userLibrary.findFirst({
		where: and(
			eq(userLibrary.userId, userId),
			eq(userLibrary.courseId, lessonRow.courseId),
			or(isNull(userLibrary.expiresAt), gt(userLibrary.expiresAt, new Date()))
		),
		columns: { id: true },
	});

	return { hasAccess: Boolean(row) };
}
