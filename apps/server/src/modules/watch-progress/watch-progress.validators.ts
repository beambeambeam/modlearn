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
