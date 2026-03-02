import { z } from "zod";

const deviceTypeSchema = z.string().trim().min(1).max(64).nullable().optional();

export const watchProgressSaveInputSchema = z.object({
	contentId: z.uuid(),
	playlistId: z.uuid().nullable().optional(),
	lastPosition: z.number().int().min(0),
	duration: z.number().int().positive(),
	deviceType: deviceTypeSchema,
});

export const watchProgressMarkCompletedInputSchema = z.object({
	contentId: z.uuid(),
	playlistId: z.uuid().nullable().optional(),
	duration: z.number().int().positive().optional(),
	deviceType: deviceTypeSchema,
});

export const watchProgressGetResumeInputSchema = z.object({
	contentId: z.uuid(),
});

export const watchProgressContinueWatchingInputSchema = z.object({
	page: z.number().int().min(1).default(1),
	limit: z.number().int().min(1).max(50).default(20),
});

export const watchProgressSchema = z.object({
	id: z.uuid(),
	userId: z.string(),
	contentId: z.uuid(),
	playlistId: z.uuid().nullable(),
	lastPosition: z.number().int(),
	duration: z.number().int(),
	isCompleted: z.boolean(),
	deviceType: z.string().nullable(),
	updatedAt: z.date(),
});

export const watchProgressEnvelopeSchema = z.object({
	progress: watchProgressSchema,
	progressPercent: z.number(),
});

export const watchProgressResumeOutputSchema = watchProgressEnvelopeSchema
	.extend({
		resumePosition: z.number(),
	})
	.nullable();

export const continueWatchingItemSchema = z.object({
	progress: watchProgressSchema,
	progressPercent: z.number(),
	content: z.object({
		id: z.uuid(),
		title: z.string(),
		thumbnailImageId: z.string().nullable(),
		duration: z.number().int().nullable(),
		contentType: z.enum(["MOVIE", "SERIES", "EPISODE", "MUSIC"]),
		releaseDate: z.date().nullable(),
	}),
});

export const continueWatchingOutputSchema = z.object({
	items: z.array(continueWatchingItemSchema),
	pagination: z.object({
		page: z.number().int(),
		limit: z.number().int(),
		total: z.number().int(),
		totalPages: z.number().int(),
	}),
});
