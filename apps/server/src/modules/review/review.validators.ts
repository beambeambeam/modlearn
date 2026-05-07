import { z } from "zod";

const commentSchema = z
	.string()
	.trim()
	.max(2000)
	.transform((value) => (value.length === 0 ? null : value));

export const reviewSortBySchema = z.enum([
	"NEWEST",
	"HIGHEST_RATING",
	"LOWEST_RATING",
]);

export const reviewVisibilityFilterSchema = z.enum([
	"VISIBLE",
	"HIDDEN",
	"ALL",
]);

export const reviewListByCourseInputSchema = z.object({
	courseId: z.uuid(),
	page: z.number().int().min(1).default(1),
	limit: z.number().int().min(1).max(50).default(20),
	sortBy: reviewSortBySchema.default("NEWEST"),
});

export const reviewGetCourseSummaryInputSchema = z.object({
	courseId: z.uuid(),
});

export const reviewGetMineInputSchema = z.object({
	courseId: z.uuid(),
});

export const reviewUpsertMineInputSchema = z.object({
	courseId: z.uuid(),
	rating: z.number().int().min(1).max(5),
	comment: commentSchema.nullable().optional(),
});

export const reviewDeleteMineInputSchema = z.object({
	courseId: z.uuid(),
});

export const reviewAdminListInputSchema = z.object({
	courseId: z.uuid().optional(),
	userId: z.string().min(1).optional(),
	visibility: reviewVisibilityFilterSchema.default("ALL"),
	page: z.number().int().min(1).default(1),
	limit: z.number().int().min(1).max(50).default(20),
});

export const reviewAdminHideInputSchema = z.object({
	reviewId: z.uuid(),
	reason: commentSchema.nullable().optional(),
});

export const reviewAdminUnhideInputSchema = z.object({
	reviewId: z.uuid(),
});

export const reviewAdminDeleteInputSchema = z.object({
	reviewId: z.uuid(),
});

export const reviewAuthorSchema = z.object({
	id: z.string(),
	displayName: z.string(),
});

export const reviewPublicItemSchema = z.object({
	id: z.uuid(),
	courseId: z.uuid(),
	rating: z.number().int(),
	comment: z.string().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
	author: reviewAuthorSchema,
});

export const reviewAdminItemSchema = reviewPublicItemSchema.extend({
	userId: z.string(),
	isVisible: z.boolean(),
	hiddenAt: z.date().nullable(),
	hiddenBy: z.string().nullable(),
	moderationReason: z.string().nullable(),
});

export const reviewSummarySchema = z.object({
	courseId: z.uuid(),
	averageRating: z.number().min(1).max(5).nullable(),
	ratingCount: z.number().int().min(0),
	ratingBreakdown: z.object({
		1: z.number().int().min(0),
		2: z.number().int().min(0),
		3: z.number().int().min(0),
		4: z.number().int().min(0),
		5: z.number().int().min(0),
	}),
});

export const reviewCompactSummarySchema = z.object({
	averageRating: z.number().min(1).max(5).nullable(),
	ratingCount: z.number().int().min(0),
});

export const reviewPaginationSchema = z.object({
	page: z.number().int(),
	limit: z.number().int(),
	total: z.number().int(),
	totalPages: z.number().int(),
});

export const reviewPublicListOutputSchema = z.object({
	items: z.array(reviewPublicItemSchema),
	pagination: reviewPaginationSchema,
});

export const reviewAdminListOutputSchema = z.object({
	items: z.array(reviewAdminItemSchema),
	pagination: reviewPaginationSchema,
});

export const reviewDeleteResultSchema = z.object({
	courseId: z.uuid(),
	deleted: z.literal(true),
});

export const reviewAdminDeleteResultSchema = z.object({
	reviewId: z.uuid(),
	deleted: z.literal(true),
});
