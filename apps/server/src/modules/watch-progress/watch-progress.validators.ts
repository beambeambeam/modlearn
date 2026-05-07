import { z } from "zod";

const deviceTypeSchema = z.string().trim().min(1).max(64).nullable().optional();

export const watchProgressSaveInputSchema = z.object({
	courseId: z.uuid(),
	courseLessonId: z.uuid(),
	lastPosition: z.number().int().min(0),
	duration: z.number().int().positive(),
	deviceType: deviceTypeSchema,
});

export const watchProgressMarkCompletedInputSchema = z.object({
	courseId: z.uuid(),
	courseLessonId: z.uuid(),
	duration: z.number().int().positive().optional(),
	deviceType: deviceTypeSchema,
});

export const watchProgressGetResumeInputSchema = z.object({
	courseLessonId: z.uuid(),
});

export const watchProgressGetCourseResumeInputSchema = z.object({
	courseId: z.uuid(),
});

export const watchProgressGetCourseAutoPlayNextInputSchema = z.object({
	courseId: z.uuid(),
	courseLessonId: z.uuid(),
});

export const watchProgressContinueWatchingInputSchema = z.object({
	page: z.number().int().min(1).default(1),
	limit: z.number().int().min(1).max(50).default(20),
});

export const watchProgressSchema = z.object({
	id: z.uuid(),
	userId: z.string(),
	courseId: z.uuid(),
	courseLessonId: z.uuid(),
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

export const courseLessonProgressSchema = z.object({
	id: z.uuid(),
	courseId: z.uuid(),
	lessonOrder: z.number().int(),
	title: z.string(),
	description: z.string().nullable(),
	thumbnailImageId: z.string().nullable(),
	duration: z.number().int().nullable(),
	releaseDate: z.date().nullable(),
	fileId: z.string().nullable(),
	addedAt: z.date(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const courseWatchProgressResumeOutputSchema = z
	.object({
		courseId: z.uuid(),
		currentLesson: courseLessonProgressSchema,
		resumePosition: z.number().int().min(0),
		nextLesson: courseLessonProgressSchema.nullable(),
		isCourseCompleted: z.boolean(),
		lastWatchedCourseLessonId: z.uuid().nullable(),
	})
	.nullable();

export const courseAutoPlayNextOutputSchema = z.object({
	courseId: z.uuid(),
	courseLessonId: z.uuid(),
	nextLesson: courseLessonProgressSchema.nullable(),
	isCourseCompleted: z.boolean(),
});

export const continueWatchingItemSchema = z.object({
	progress: watchProgressSchema,
	progressPercent: z.number(),
	course: z.object({
		id: z.uuid(),
		title: z.string(),
		thumbnailImageId: z.string().nullable(),
	}),
	lesson: courseLessonProgressSchema,
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
