import { z } from "zod";
import { hasDuplicates } from "./course.utils";

const releaseDateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD");

export const courseListInputSchema = z
	.object({
		page: z.number().int().min(1).default(1),
		limit: z.number().int().min(1).max(50).default(20),
		search: z.string().trim().min(1).optional(),
		categoryIds: z.array(z.uuid()).optional(),
		sortBy: z
			.enum(["RECENTLY_ADDED", "RECENTLY_PUBLISHED"])
			.default("RECENTLY_ADDED"),
	})
	.superRefine((value, ctx) => {
		if (value.categoryIds && hasDuplicates(value.categoryIds)) {
			ctx.addIssue({
				code: "custom",
				path: ["categoryIds"],
				message: "categoryIds contains duplicates",
			});
		}
	});

export const courseByIdInputSchema = z.object({
	id: z.uuid(),
});

export const courseAdminListInputSchema = courseListInputSchema.extend({
	onlyPublished: z.boolean().default(false),
});

export const courseAdminByIdInputSchema = courseByIdInputSchema.extend({
	onlyPublished: z.boolean().default(false),
});

export const courseListPopularInputSchema = z.object({
	limit: z.number().int().min(1).max(50).default(10),
});

export const courseAdminCreateInputSchema = z.object({
	title: z.string().trim().min(1),
	description: z.string().trim().min(1).nullable().optional(),
	thumbnailImageId: z.uuid().nullable().optional(),
});

export const courseAdminUpdateInputSchema = z.object({
	id: z.uuid(),
	patch: courseAdminCreateInputSchema
		.partial()
		.refine(
			(value) => Object.keys(value).length > 0,
			"At least one field must be provided in patch"
		),
});

export const courseAdminSetPublishStateInputSchema = z.object({
	id: z.uuid(),
	isPublished: z.boolean(),
});

export const courseAdminDeleteInputSchema = z.object({
	id: z.uuid(),
});

export const courseAdminSetAvailabilityInputSchema = z.object({
	id: z.uuid(),
	isAvailable: z.boolean(),
});

export const courseAdminSetClassificationInputSchema = z
	.object({
		id: z.uuid(),
		categoryIds: z.array(z.uuid()),
	})
	.superRefine((value, ctx) => {
		if (hasDuplicates(value.categoryIds)) {
			ctx.addIssue({
				code: "custom",
				path: ["categoryIds"],
				message: "categoryIds contains duplicates",
			});
		}
	});

export const courseListLessonsInputSchema = z.object({
	courseId: z.uuid(),
});

export const courseAdminAddLessonInputSchema = z.object({
	courseId: z.uuid(),
	title: z.string().trim().min(1),
	description: z.string().trim().min(1).nullable().optional(),
	thumbnailImageId: z.uuid().nullable().optional(),
	duration: z.number().int().positive().nullable().optional(),
	releaseDate: releaseDateSchema.nullable().optional(),
	fileId: z.uuid().nullable().optional(),
	lessonOrder: z.number().int().min(1).optional(),
});

export const courseAdminUpdateLessonInputSchema = z.object({
	id: z.uuid(),
	patch: z
		.object({
			title: z.string().trim().min(1).optional(),
			description: z.string().trim().min(1).nullable().optional(),
			thumbnailImageId: z.uuid().nullable().optional(),
			duration: z.number().int().positive().nullable().optional(),
			releaseDate: releaseDateSchema.nullable().optional(),
			fileId: z.uuid().nullable().optional(),
			lessonOrder: z.number().int().min(1).optional(),
		})
		.refine(
			(value) => Object.keys(value).length > 0,
			"At least one field must be provided in patch"
		),
});

export const courseAdminRemoveLessonInputSchema = z.object({
	id: z.uuid(),
});

export const courseAdminReorderLessonsInputSchema = z.object({
	courseId: z.uuid(),
	lessonIds: z.array(z.uuid()).min(1),
});

export const courseClassificationItemSchema = z.object({
	id: z.uuid(),
	title: z.string(),
	slug: z.string().nullable(),
	description: z.string().nullable(),
});

export const activePricingSchema = z
	.object({
		price: z.string(),
		currency: z.string(),
	})
	.nullable();

export const courseSchema = z.object({
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
	activePricing: activePricingSchema.default(null),
});

export const courseLessonSchema = z.object({
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

export const courseListOutputSchema = z.object({
	items: z.array(courseSchema),
	pagination: z.object({
		page: z.number().int(),
		limit: z.number().int(),
		total: z.number().int(),
		totalPages: z.number().int(),
	}),
});

export const courseDetailOutputSchema = courseSchema.extend({
	categories: z.array(courseClassificationItemSchema),
	lessons: z.array(courseLessonSchema),
});

export const courseClassificationOutputSchema = z.object({
	courseId: z.uuid(),
	categories: z.array(courseClassificationItemSchema),
});

export const courseDeleteOutputSchema = z.object({
	id: z.uuid(),
	deleted: z.literal(true),
	deletedAt: z.date(),
});

export const courseLessonDeleteOutputSchema = z.object({
	id: z.uuid(),
	courseId: z.uuid(),
	deleted: z.literal(true),
});
