import { z } from "zod";

export const libraryListMyItemsInputSchema = z.object({
	page: z.number().int().min(1).default(1),
	limit: z.number().int().min(1).max(50).default(20),
});

export const libraryGetCourseInputSchema = z.object({
	courseId: z.uuid(),
});

export const libraryHasAccessInputSchema = z
	.object({
		courseId: z.uuid().optional(),
		courseLessonId: z.uuid().optional(),
	})
	.superRefine((value, ctx) => {
		const provided =
			Number(Boolean(value.courseId)) + Number(Boolean(value.courseLessonId));
		if (provided !== 1) {
			ctx.addIssue({
				code: "custom",
				message: "Exactly one of courseId or courseLessonId must be provided",
				path: ["courseId"],
			});
		}
	});

export const libraryCourseLessonSummarySchema = z.object({
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

export const libraryCourseSummarySchema = z.object({
	id: z.uuid(),
	creatorId: z.string(),
	title: z.string(),
	description: z.string().nullable(),
	thumbnailImageId: z.string().nullable(),
	isPublished: z.boolean(),
	publishedAt: z.date().nullable(),
	isAvailable: z.boolean(),
	isDeleted: z.boolean(),
	deletedAt: z.date().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const libraryCourseItemSchema = z.object({
	type: z.literal("COURSE"),
	acquiredAt: z.date(),
	expiresAt: z.date().nullable(),
	orderId: z.uuid(),
	course: libraryCourseSummarySchema,
	lessons: z.array(libraryCourseLessonSummarySchema),
});

export const libraryItemSchema = libraryCourseItemSchema;

export const libraryListMyItemsOutputSchema = z.object({
	items: z.array(libraryItemSchema),
	pagination: z.object({
		page: z.number().int(),
		limit: z.number().int(),
		total: z.number().int(),
		totalPages: z.number().int(),
	}),
});

export const libraryHasAccessOutputSchema = z.object({
	hasAccess: z.boolean(),
});
