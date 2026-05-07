import type { SQL } from "drizzle-orm";
import {
	and,
	asc,
	count,
	desc,
	eq,
	gt,
	inArray,
	isNull,
	or,
	sql,
} from "drizzle-orm";
import type { DbClient } from "@/lib/db/orm";
import { course, courseReview, user, userLibrary } from "@/lib/db/schema";
import type {
	AdminDeleteReviewParams,
	AdminHideReviewParams,
	AdminListReviewsParams,
	AdminUnhideReviewParams,
	CourseReviewRow,
	DeleteMyCourseReviewParams,
	GetCourseReviewSummaryParams,
	GetMyCourseReviewParams,
	ListCourseReviewsParams,
	ReviewAdminDeleteResult,
	ReviewAdminItem,
	ReviewCompactSummary,
	ReviewListResult,
	ReviewPublicItem,
	ReviewSortBy,
	ReviewSummary,
	UpsertMyCourseReviewParams,
} from "./review.types";
import {
	ReviewCourseNotFoundError,
	ReviewModerationValidationError,
	ReviewNotFoundError,
	ReviewOwnershipRequiredError,
} from "./review.types";

function toPagination(input: { page: number; limit: number; total: number }) {
	const { page, limit, total } = input;
	return {
		page,
		limit,
		total,
		totalPages: total === 0 ? 0 : Math.ceil(total / limit),
	};
}

function normalizeComment(comment?: string | null): string | null {
	const trimmed = comment?.trim() ?? "";
	return trimmed.length > 0 ? trimmed : null;
}

function getDisplayName(author: {
	displayUsername: string | null;
	username: string | null;
	name: string;
}): string {
	return author.displayUsername ?? author.username ?? author.name;
}

function buildReviewOrderBy(sortBy: ReviewSortBy) {
	switch (sortBy) {
		case "HIGHEST_RATING":
			return [
				desc(courseReview.rating),
				desc(courseReview.createdAt),
				desc(courseReview.id),
			] as const;
		case "LOWEST_RATING":
			return [
				asc(courseReview.rating),
				desc(courseReview.createdAt),
				desc(courseReview.id),
			] as const;
		default:
			return [desc(courseReview.createdAt), desc(courseReview.id)] as const;
	}
}

function visibleReviewCondition() {
	return eq(courseReview.isVisible, true);
}

async function assertCourseExists(params: {
	db: DbClient;
	courseId: string;
	onlyPublished?: boolean;
}): Promise<void> {
	const { db, courseId, onlyPublished = false } = params;
	const conditions: SQL<unknown>[] = [
		eq(course.id, courseId),
		eq(course.isDeleted, false),
	];

	if (onlyPublished) {
		conditions.push(eq(course.isPublished, true), eq(course.isAvailable, true));
	}

	const row = await db.query.course.findFirst({
		where: and(...conditions),
		columns: { id: true },
	});

	if (!row) {
		throw new ReviewCourseNotFoundError();
	}
}

async function assertCourseOwnership(params: {
	db: DbClient;
	courseId: string;
	userId: string;
}): Promise<void> {
	const row = await params.db.query.userLibrary.findFirst({
		where: and(
			eq(userLibrary.userId, params.userId),
			eq(userLibrary.courseId, params.courseId),
			or(isNull(userLibrary.expiresAt), gt(userLibrary.expiresAt, new Date()))
		),
		columns: { id: true },
	});

	if (!row) {
		throw new ReviewOwnershipRequiredError();
	}
}

async function getReviewByIdOrThrow(
	db: DbClient,
	reviewId: string
): Promise<CourseReviewRow> {
	const row = await db.query.courseReview.findFirst({
		where: eq(courseReview.id, reviewId),
	});

	if (!row) {
		throw new ReviewNotFoundError();
	}

	return row;
}

function toPublicReviewItem(row: {
	id: string;
	courseId: string;
	rating: number;
	comment: string | null;
	createdAt: Date;
	updatedAt: Date;
	userId: string;
	name: string;
	username: string | null;
	displayUsername: string | null;
}): ReviewPublicItem {
	return {
		id: row.id,
		courseId: row.courseId,
		rating: row.rating,
		comment: row.comment,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		author: {
			id: row.userId,
			displayName: getDisplayName(row),
		},
	};
}

function toAdminReviewItem(row: {
	id: string;
	courseId: string;
	rating: number;
	comment: string | null;
	createdAt: Date;
	updatedAt: Date;
	userId: string;
	name: string;
	username: string | null;
	displayUsername: string | null;
	isVisible: boolean;
	hiddenAt: Date | null;
	hiddenBy: string | null;
	moderationReason: string | null;
}): ReviewAdminItem {
	return {
		...toPublicReviewItem(row),
		userId: row.userId,
		isVisible: row.isVisible,
		hiddenAt: row.hiddenAt,
		hiddenBy: row.hiddenBy,
		moderationReason: row.moderationReason,
	};
}

function emptyReviewSummary(courseId: string): ReviewSummary {
	return {
		courseId,
		averageRating: null,
		ratingCount: 0,
		ratingBreakdown: {
			1: 0,
			2: 0,
			3: 0,
			4: 0,
			5: 0,
		},
	};
}

function toAverageRating(value: string | null): number | null {
	if (value === null) {
		return null;
	}

	return Number(Number(value).toFixed(2));
}

export async function getCourseReviewSummaryMap(params: {
	db: DbClient;
	courseIds: string[];
}): Promise<Map<string, ReviewSummary>> {
	const { db, courseIds } = params;

	if (courseIds.length === 0) {
		return new Map();
	}

	const rows = await db
		.select({
			courseId: courseReview.courseId,
			averageRating: sql<string | null>`avg(${courseReview.rating})`,
			ratingCount: count(courseReview.id),
			oneStar: sql<number>`coalesce(sum(case when ${courseReview.rating} = 1 then 1 else 0 end), 0)::int`,
			twoStar: sql<number>`coalesce(sum(case when ${courseReview.rating} = 2 then 1 else 0 end), 0)::int`,
			threeStar: sql<number>`coalesce(sum(case when ${courseReview.rating} = 3 then 1 else 0 end), 0)::int`,
			fourStar: sql<number>`coalesce(sum(case when ${courseReview.rating} = 4 then 1 else 0 end), 0)::int`,
			fiveStar: sql<number>`coalesce(sum(case when ${courseReview.rating} = 5 then 1 else 0 end), 0)::int`,
		})
		.from(courseReview)
		.where(
			and(inArray(courseReview.courseId, courseIds), visibleReviewCondition())
		)
		.groupBy(courseReview.courseId);

	const summaryMap = new Map<string, ReviewSummary>();

	for (const courseId of courseIds) {
		summaryMap.set(courseId, emptyReviewSummary(courseId));
	}

	for (const row of rows) {
		summaryMap.set(row.courseId, {
			courseId: row.courseId,
			averageRating: toAverageRating(row.averageRating),
			ratingCount: Number(row.ratingCount),
			ratingBreakdown: {
				1: row.oneStar,
				2: row.twoStar,
				3: row.threeStar,
				4: row.fourStar,
				5: row.fiveStar,
			},
		});
	}

	return summaryMap;
}

export async function listRecentVisibleReviewsByCourseIds(params: {
	db: DbClient;
	courseIds: string[];
	limitPerCourse: number;
}): Promise<Map<string, ReviewPublicItem[]>> {
	const { db, courseIds, limitPerCourse } = params;

	if (courseIds.length === 0 || limitPerCourse <= 0) {
		return new Map();
	}

	const rows = await db
		.select({
			id: courseReview.id,
			courseId: courseReview.courseId,
			rating: courseReview.rating,
			comment: courseReview.comment,
			createdAt: courseReview.createdAt,
			updatedAt: courseReview.updatedAt,
			userId: user.id,
			name: user.name,
			username: user.username,
			displayUsername: user.displayUsername,
		})
		.from(courseReview)
		.innerJoin(user, eq(courseReview.userId, user.id))
		.where(
			and(inArray(courseReview.courseId, courseIds), visibleReviewCondition())
		)
		.orderBy(
			asc(courseReview.courseId),
			desc(courseReview.createdAt),
			desc(courseReview.id)
		);

	const byCourseId = new Map<string, ReviewPublicItem[]>();
	for (const courseId of courseIds) {
		byCourseId.set(courseId, []);
	}

	for (const row of rows) {
		const current = byCourseId.get(row.courseId) ?? [];
		if (current.length >= limitPerCourse) {
			continue;
		}

		current.push(toPublicReviewItem(row));
		byCourseId.set(row.courseId, current);
	}

	return byCourseId;
}

export async function listCourseReviews(
	params: ListCourseReviewsParams
): Promise<ReviewListResult<ReviewPublicItem>> {
	const { db, input } = params;
	const page = input.page ?? 1;
	const limit = input.limit ?? 20;
	const offset = (page - 1) * limit;

	await assertCourseExists({
		db,
		courseId: input.courseId,
		onlyPublished: true,
	});

	const where = and(
		eq(courseReview.courseId, input.courseId),
		visibleReviewCondition()
	);

	const [countRows, rows] = await Promise.all([
		db.select({ total: count() }).from(courseReview).where(where),
		db
			.select({
				id: courseReview.id,
				courseId: courseReview.courseId,
				rating: courseReview.rating,
				comment: courseReview.comment,
				createdAt: courseReview.createdAt,
				updatedAt: courseReview.updatedAt,
				userId: user.id,
				name: user.name,
				username: user.username,
				displayUsername: user.displayUsername,
			})
			.from(courseReview)
			.innerJoin(user, eq(courseReview.userId, user.id))
			.where(where)
			.orderBy(...buildReviewOrderBy(input.sortBy ?? "NEWEST"))
			.limit(limit)
			.offset(offset),
	]);

	return {
		items: rows.map((row) => toPublicReviewItem(row)),
		pagination: toPagination({
			page,
			limit,
			total: Number(countRows[0]?.total ?? 0),
		}),
	};
}

export async function getCourseReviewSummary(
	params: GetCourseReviewSummaryParams
): Promise<ReviewSummary> {
	const { db, input } = params;

	await assertCourseExists({
		db,
		courseId: input.courseId,
		onlyPublished: true,
	});

	const summaryMap = await getCourseReviewSummaryMap({
		db,
		courseIds: [input.courseId],
	});

	return summaryMap.get(input.courseId) ?? emptyReviewSummary(input.courseId);
}

export async function getMyCourseReview(
	params: GetMyCourseReviewParams
): Promise<ReviewAdminItem | null> {
	const { db, userId, input } = params;

	await assertCourseExists({
		db,
		courseId: input.courseId,
	});

	const row = await db
		.select({
			id: courseReview.id,
			courseId: courseReview.courseId,
			rating: courseReview.rating,
			comment: courseReview.comment,
			createdAt: courseReview.createdAt,
			updatedAt: courseReview.updatedAt,
			userId: user.id,
			name: user.name,
			username: user.username,
			displayUsername: user.displayUsername,
			isVisible: courseReview.isVisible,
			hiddenAt: courseReview.hiddenAt,
			hiddenBy: courseReview.hiddenBy,
			moderationReason: courseReview.moderationReason,
		})
		.from(courseReview)
		.innerJoin(user, eq(courseReview.userId, user.id))
		.where(
			and(
				eq(courseReview.courseId, input.courseId),
				eq(courseReview.userId, userId)
			)
		)
		.limit(1);

	return row[0] ? toAdminReviewItem(row[0]) : null;
}

export async function upsertMyCourseReview(
	params: UpsertMyCourseReviewParams
): Promise<ReviewAdminItem> {
	const { db, userId, input } = params;

	await assertCourseExists({
		db,
		courseId: input.courseId,
	});
	await assertCourseOwnership({
		db,
		courseId: input.courseId,
		userId,
	});

	const comment = normalizeComment(input.comment);

	return db.transaction(async (tx) => {
		const existing = await tx.query.courseReview.findFirst({
			where: and(
				eq(courseReview.courseId, input.courseId),
				eq(courseReview.userId, userId)
			),
		});

		if (existing) {
			await tx
				.update(courseReview)
				.set({
					rating: input.rating,
					comment,
				})
				.where(eq(courseReview.id, existing.id));
		} else {
			await tx.insert(courseReview).values({
				courseId: input.courseId,
				userId,
				rating: input.rating,
				comment,
				isVisible: true,
				hiddenAt: null,
				hiddenBy: null,
				moderationReason: null,
			});
		}

		const review = await getMyCourseReview({
			db: tx,
			userId,
			input: { courseId: input.courseId },
		});

		if (!review) {
			throw new Error("Failed to upsert review");
		}

		return review;
	});
}

export async function deleteMyCourseReview(
	params: DeleteMyCourseReviewParams
): Promise<{ courseId: string; deleted: true }> {
	const { db, userId, input } = params;

	await assertCourseExists({
		db,
		courseId: input.courseId,
	});

	const deleted = await db
		.delete(courseReview)
		.where(
			and(
				eq(courseReview.courseId, input.courseId),
				eq(courseReview.userId, userId)
			)
		)
		.returning({ id: courseReview.id });

	if (deleted.length === 0) {
		throw new ReviewNotFoundError();
	}

	return {
		courseId: input.courseId,
		deleted: true,
	};
}

export async function adminListReviews(
	params: AdminListReviewsParams
): Promise<ReviewListResult<ReviewAdminItem>> {
	const { db, input } = params;
	const page = input.page ?? 1;
	const limit = input.limit ?? 20;
	const offset = (page - 1) * limit;
	const visibility = input.visibility ?? "ALL";
	const conditions: SQL<unknown>[] = [];

	if (input.courseId) {
		conditions.push(eq(courseReview.courseId, input.courseId));
	}

	if (input.userId) {
		conditions.push(eq(courseReview.userId, input.userId));
	}

	if (visibility === "VISIBLE") {
		conditions.push(eq(courseReview.isVisible, true));
	}

	if (visibility === "HIDDEN") {
		conditions.push(eq(courseReview.isVisible, false));
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const [countRows, rows] = await Promise.all([
		db.select({ total: count() }).from(courseReview).where(where),
		db
			.select({
				id: courseReview.id,
				courseId: courseReview.courseId,
				rating: courseReview.rating,
				comment: courseReview.comment,
				createdAt: courseReview.createdAt,
				updatedAt: courseReview.updatedAt,
				userId: user.id,
				name: user.name,
				username: user.username,
				displayUsername: user.displayUsername,
				isVisible: courseReview.isVisible,
				hiddenAt: courseReview.hiddenAt,
				hiddenBy: courseReview.hiddenBy,
				moderationReason: courseReview.moderationReason,
			})
			.from(courseReview)
			.innerJoin(user, eq(courseReview.userId, user.id))
			.where(where)
			.orderBy(desc(courseReview.createdAt), desc(courseReview.id))
			.limit(limit)
			.offset(offset),
	]);

	return {
		items: rows.map((row) => toAdminReviewItem(row)),
		pagination: toPagination({
			page,
			limit,
			total: Number(countRows[0]?.total ?? 0),
		}),
	};
}

export function adminHideReview(
	params: AdminHideReviewParams
): Promise<ReviewAdminItem> {
	const { db, adminUserId, input } = params;

	return db.transaction(async (tx) => {
		const existing = await getReviewByIdOrThrow(tx, input.reviewId);

		if (!existing.isVisible) {
			throw new ReviewModerationValidationError("Review is already hidden");
		}

		await tx
			.update(courseReview)
			.set({
				isVisible: false,
				hiddenAt: new Date(),
				hiddenBy: adminUserId,
				moderationReason: normalizeComment(input.reason),
			})
			.where(eq(courseReview.id, input.reviewId));

		const listed = await adminListReviews({
			db: tx,
			input: {
				userId: existing.userId,
				courseId: existing.courseId,
				visibility: "ALL",
				page: 1,
				limit: 50,
			},
		});

		const hidden = listed.items.find((item) => item.id === input.reviewId);
		if (!hidden) {
			throw new ReviewNotFoundError();
		}

		return hidden;
	});
}

export function adminUnhideReview(
	params: AdminUnhideReviewParams
): Promise<ReviewAdminItem> {
	const { db, input } = params;

	return db.transaction(async (tx) => {
		const existing = await getReviewByIdOrThrow(tx, input.reviewId);

		if (existing.isVisible) {
			throw new ReviewModerationValidationError("Review is already visible");
		}

		await tx
			.update(courseReview)
			.set({
				isVisible: true,
				hiddenAt: null,
				hiddenBy: null,
				moderationReason: null,
			})
			.where(eq(courseReview.id, input.reviewId));

		const listed = await adminListReviews({
			db: tx,
			input: {
				userId: existing.userId,
				courseId: existing.courseId,
				visibility: "ALL",
				page: 1,
				limit: 50,
			},
		});

		const review = listed.items.find((item) => item.id === input.reviewId);
		if (!review) {
			throw new ReviewNotFoundError();
		}

		return review;
	});
}

export async function adminDeleteReview(
	params: AdminDeleteReviewParams
): Promise<ReviewAdminDeleteResult> {
	const { db, input } = params;

	const deleted = await db
		.delete(courseReview)
		.where(eq(courseReview.id, input.reviewId))
		.returning({ id: courseReview.id });

	if (deleted.length === 0) {
		throw new ReviewNotFoundError();
	}

	return {
		reviewId: input.reviewId,
		deleted: true,
	};
}

export async function getCourseReviewCompactSummaryMap(params: {
	db: DbClient;
	courseIds: string[];
}): Promise<Map<string, ReviewCompactSummary>> {
	const summaryMap = await getCourseReviewSummaryMap(params);
	return new Map(
		Array.from(summaryMap.entries()).map(([courseId, summary]) => [
			courseId,
			{
				averageRating: summary.averageRating,
				ratingCount: summary.ratingCount,
			},
		])
	);
}
