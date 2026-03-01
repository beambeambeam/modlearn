import { z } from "zod";

export const genreListInputSchema = z.object({
	search: z.string().trim().min(1).optional(),
	page: z.number().int().min(1).default(1),
	limit: z.number().int().min(1).max(50).default(20),
});

export const genreByIdInputSchema = z.object({
	id: z.uuid(),
});

export const genreAdminCreateInputSchema = z.object({
	title: z.string().trim().min(1),
	description: z.string().trim().min(1).nullable().optional(),
	slug: z.string().trim().min(1),
});

export const genreAdminUpdateInputSchema = z.object({
	id: z.uuid(),
	patch: genreAdminCreateInputSchema
		.partial()
		.refine(
			(value) => Object.keys(value).length > 0,
			"At least one field must be provided in patch"
		),
});

export const genreAdminDeleteInputSchema = z.object({
	id: z.uuid(),
});
