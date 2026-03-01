import { z } from "zod";
import { hasDuplicates } from "./content.utils";

const contentTypeSchema = z.enum(["MOVIE", "SERIES", "EPISODE", "MUSIC"]);

const releaseDateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD");

export const contentListInputSchema = z
	.object({
		page: z.number().int().min(1).default(1),
		limit: z.number().int().min(1).max(50).default(20),
		search: z.string().trim().min(1).optional(),
		contentType: contentTypeSchema.optional(),
		categoryIds: z.array(z.uuid()).optional(),
		genreIds: z.array(z.uuid()).optional(),
		sortBy: z
			.enum(["RECENTLY_ADDED", "RECENTLY_PUBLISHED"])
			.default("RECENTLY_ADDED"),
		onlyPublished: z.boolean().default(true),
	})
	.superRefine((value, ctx) => {
		if (value.categoryIds && hasDuplicates(value.categoryIds)) {
			ctx.addIssue({
				code: "custom",
				path: ["categoryIds"],
				message: "categoryIds contains duplicates",
			});
		}

		if (value.genreIds && hasDuplicates(value.genreIds)) {
			ctx.addIssue({
				code: "custom",
				path: ["genreIds"],
				message: "genreIds contains duplicates",
			});
		}
	});

export const contentByIdInputSchema = z.object({
	id: z.uuid(),
	onlyPublished: z.boolean().default(true),
});

export const contentListPopularInputSchema = z.object({
	limit: z.number().int().min(1).max(50).default(10),
});

export const contentAdminCreateInputSchema = z.object({
	title: z.string().trim().min(1),
	description: z.string().trim().min(1).nullable().optional(),
	thumbnailImageId: z.uuid().nullable().optional(),
	duration: z.number().int().positive().nullable().optional(),
	releaseDate: releaseDateSchema.nullable().optional(),
	contentType: contentTypeSchema,
	fileId: z.uuid().nullable().optional(),
});

export const contentAdminUpdateInputSchema = z.object({
	id: z.uuid(),
	patch: contentAdminCreateInputSchema
		.partial()
		.refine(
			(value) => Object.keys(value).length > 0,
			"At least one field must be provided in patch"
		),
});

export const contentAdminSetPublishStateInputSchema = z.object({
	id: z.uuid(),
	isPublished: z.boolean(),
});

export const contentAdminDeleteInputSchema = z.object({
	id: z.uuid(),
});

export const contentAdminSetAvailabilityInputSchema = z.object({
	id: z.uuid(),
	isAvailable: z.boolean(),
});

export const contentAdminSetClassificationInputSchema = z
	.object({
		id: z.uuid(),
		categoryIds: z.array(z.uuid()).optional(),
		genreIds: z.array(z.uuid()).optional(),
	})
	.superRefine((value, ctx) => {
		if (value.categoryIds === undefined && value.genreIds === undefined) {
			ctx.addIssue({
				code: "custom",
				message: "At least one of categoryIds or genreIds must be provided",
			});
		}

		if (value.categoryIds && hasDuplicates(value.categoryIds)) {
			ctx.addIssue({
				code: "custom",
				path: ["categoryIds"],
				message: "categoryIds contains duplicates",
			});
		}

		if (value.genreIds && hasDuplicates(value.genreIds)) {
			ctx.addIssue({
				code: "custom",
				path: ["genreIds"],
				message: "genreIds contains duplicates",
			});
		}
	});
