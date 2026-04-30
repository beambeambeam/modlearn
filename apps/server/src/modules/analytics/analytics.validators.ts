import { z } from "zod";

const contentTypeSchema = z.enum(["MOVIE", "SERIES", "EPISODE", "MUSIC"]);

const paginationInputSchema = z.object({
	page: z.number().int().min(1).default(1),
	limit: z.number().int().min(1).max(100).default(20),
});

export const analyticsOverviewInputSchema = z.object({
	from: z.date().optional(),
	to: z.date().optional(),
});

export const analyticsContentViewsInputSchema = paginationInputSchema.extend({
	from: z.date().optional(),
	to: z.date().optional(),
	contentType: contentTypeSchema.optional(),
	search: z.string().trim().min(1).optional(),
});

export const analyticsViewSessionsInputSchema = paginationInputSchema.extend({
	from: z.date().optional(),
	to: z.date().optional(),
	userId: z.string().trim().min(1).optional(),
	contentId: z.uuid().optional(),
});

export const analyticsPaginationSchema = z.object({
	page: z.number().int(),
	limit: z.number().int(),
	total: z.number().int(),
	totalPages: z.number().int(),
});

export const analyticsOverviewOutputSchema = z.object({
	totalViews: z.number().int(),
	totalWatchDuration: z.number().int(),
	generatedAt: z.date(),
});

export const analyticsContentViewsOutputSchema = z.object({
	items: z.array(
		z.object({
			contentId: z.uuid(),
			title: z.string(),
			contentType: contentTypeSchema,
			aggregatedViews: z.number().int(),
			aggregatedWatchDuration: z.number().int(),
			cachedViewCount: z.number().int(),
		})
	),
	pagination: analyticsPaginationSchema,
});

export const analyticsViewSessionsOutputSchema = z.object({
	items: z.array(
		z.object({
			id: z.uuid(),
			contentId: z.uuid(),
			userId: z.string().nullable(),
			viewedAt: z.date(),
			watchDuration: z.number().int().nullable(),
			deviceType: z.string().nullable(),
		})
	),
	pagination: analyticsPaginationSchema,
});
