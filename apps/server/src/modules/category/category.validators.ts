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
