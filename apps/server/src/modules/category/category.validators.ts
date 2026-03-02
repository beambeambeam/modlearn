import { z } from "zod";

export const categoryListInputSchema = z.object({
	search: z.string().trim().min(1).optional(),
	page: z.number().int().min(1).default(1),
	limit: z.number().int().min(1).max(50).default(20),
});

export const categoryByIdInputSchema = z.object({
	id: z.uuid(),
});

export const categoryAdminCreateInputSchema = z.object({
	title: z.string().trim().min(1),
	description: z.string().trim().min(1).nullable().optional(),
	slug: z.string().trim().min(1),
});

export const categoryAdminUpdateInputSchema = z.object({
	id: z.uuid(),
	patch: categoryAdminCreateInputSchema
		.partial()
		.refine(
			(value) => Object.keys(value).length > 0,
			"At least one field must be provided in patch"
		),
});

export const categoryAdminDeleteInputSchema = z.object({
	id: z.uuid(),
});

export const categorySchema = z.object({
	id: z.uuid(),
	title: z.string(),
	description: z.string().nullable(),
	slug: z.string().nullable(),
});

export const categoryListOutputSchema = z.object({
	items: z.array(categorySchema),
	pagination: z.object({
		page: z.number().int(),
		limit: z.number().int(),
		total: z.number().int(),
		totalPages: z.number().int(),
	}),
});

export const categoryDeleteOutputSchema = z.object({
	id: z.uuid(),
	deleted: z.literal(true),
});
