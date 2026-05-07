import type { DbClient } from "@/lib/db/orm";
import type { courseReview } from "@/lib/db/schema";

export type ReviewSortBy = "NEWEST" | "HIGHEST_RATING" | "LOWEST_RATING";
export type ReviewVisibilityFilter = "VISIBLE" | "HIDDEN" | "ALL";

export interface ReviewListByCourseInput {
	courseId: string;
	page?: number;
	limit?: number;
	sortBy?: ReviewSortBy;
}

export interface ReviewGetCourseSummaryInput {
	courseId: string;
}

export interface ReviewGetMineInput {
	courseId: string;
}

export interface ReviewUpsertMineInput {
	courseId: string;
	rating: number;
	comment?: string | null;
}

export interface ReviewDeleteMineInput {
	courseId: string;
}

export interface ReviewAdminListInput {
	courseId?: string;
	userId?: string;
	visibility?: ReviewVisibilityFilter;
	page?: number;
	limit?: number;
}

export interface ReviewAdminHideInput {
	reviewId: string;
	reason?: string | null;
}

export interface ReviewAdminUnhideInput {
	reviewId: string;
}

export interface ReviewAdminDeleteInput {
	reviewId: string;
}

export interface ReviewAuthorView {
	id: string;
	displayName: string;
}

export interface ReviewPublicItem {
	id: string;
	courseId: string;
	rating: number;
	comment: string | null;
	createdAt: Date;
	updatedAt: Date;
	author: ReviewAuthorView;
}

export interface ReviewAdminItem extends ReviewPublicItem {
	userId: string;
	isVisible: boolean;
	hiddenAt: Date | null;
	hiddenBy: string | null;
	moderationReason: string | null;
}

export interface ReviewSummary {
	courseId: string;
	averageRating: number | null;
	ratingCount: number;
	ratingBreakdown: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface ReviewCompactSummary {
	averageRating: number | null;
	ratingCount: number;
}

export interface ReviewPagination {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
}

export interface ReviewDeleteResult {
	courseId: string;
	deleted: true;
}

export interface ReviewAdminDeleteResult {
	reviewId: string;
	deleted: true;
}

export interface ReviewListResult<TItem> {
	items: TItem[];
	pagination: ReviewPagination;
}

export interface ListCourseReviewsParams {
	db: DbClient;
	input: ReviewListByCourseInput;
}

export interface GetCourseReviewSummaryParams {
	db: DbClient;
	input: ReviewGetCourseSummaryInput;
}

export interface GetMyCourseReviewParams {
	db: DbClient;
	userId: string;
	input: ReviewGetMineInput;
}

export interface UpsertMyCourseReviewParams {
	db: DbClient;
	userId: string;
	input: ReviewUpsertMineInput;
}

export interface DeleteMyCourseReviewParams {
	db: DbClient;
	userId: string;
	input: ReviewDeleteMineInput;
}

export interface AdminListReviewsParams {
	db: DbClient;
	input: ReviewAdminListInput;
}

export interface AdminHideReviewParams {
	db: DbClient;
	adminUserId: string;
	input: ReviewAdminHideInput;
}

export interface AdminUnhideReviewParams {
	db: DbClient;
	input: ReviewAdminUnhideInput;
}

export interface AdminDeleteReviewParams {
	db: DbClient;
	input: ReviewAdminDeleteInput;
}

export type CourseReviewRow = typeof courseReview.$inferSelect;

export class ReviewCourseNotFoundError extends Error {
	constructor() {
		super("Course not found");
		this.name = "ReviewCourseNotFoundError";
	}
}

export class ReviewOwnershipRequiredError extends Error {
	constructor() {
		super("Active course ownership is required to review this course");
		this.name = "ReviewOwnershipRequiredError";
	}
}

export class ReviewNotFoundError extends Error {
	constructor() {
		super("Review not found");
		this.name = "ReviewNotFoundError";
	}
}

export class ReviewModerationValidationError extends Error {
	constructor(message = "Invalid review moderation request") {
		super(message);
		this.name = "ReviewModerationValidationError";
	}
}
