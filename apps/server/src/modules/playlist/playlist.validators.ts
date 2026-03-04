import { z } from "zod";

export const playlistByIdInputSchema = z.object({
	id: z.uuid(),
});

export const playlistListInputSchema = z.object({
	page: z.number().int().min(1).default(1),
	limit: z.number().int().min(1).max(50).default(20),
	search: z.string().trim().min(1).optional(),
	isSeries: z.boolean().optional(),
});

export const playlistAdminListInputSchema = playlistListInputSchema.extend({
	onlyPublished: z.boolean().default(false),
});

export const playlistAdminByIdInputSchema = playlistByIdInputSchema.extend({
	onlyPublished: z.boolean().default(false),
});

export const playlistListEpisodesInputSchema = z.object({
	playlistId: z.uuid(),
	seasonNumber: z.number().int().min(1).optional(),
});

export const playlistAdminCreateInputSchema = z.object({
	title: z.string().trim().min(1),
	description: z.string().trim().min(1).nullable().optional(),
	thumbnailImageId: z.uuid().nullable().optional(),
	isSeries: z.boolean().default(true),
});

export const playlistAdminUpdateInputSchema = z.object({
	id: z.uuid(),
	patch: playlistAdminCreateInputSchema
		.partial()
		.refine(
			(value) => Object.keys(value).length > 0,
			"At least one field must be provided in patch"
		),
});

export const playlistAdminDeleteInputSchema = z.object({
	id: z.uuid(),
});

export const playlistAdminSetPublishStateInputSchema = z.object({
	id: z.uuid(),
	isPublished: z.boolean(),
});

export const playlistAdminSetAvailabilityInputSchema = z.object({
	id: z.uuid(),
	isAvailable: z.boolean(),
});

export const playlistAdminAddEpisodeInputSchema = z.object({
	playlistId: z.uuid(),
	contentId: z.uuid(),
	episodeOrder: z.number().int().min(1).optional(),
	seasonNumber: z.number().int().min(1).nullable().optional(),
	episodeNumber: z.number().int().min(1).nullable().optional(),
	title: z.string().trim().min(1).nullable().optional(),
});

export const playlistAdminReorderEpisodesInputSchema = z.object({
	playlistId: z.uuid(),
	episodeIds: z.array(z.uuid()).min(1),
});

export const playlistAdminUpdateEpisodeInputSchema = z.object({
	id: z.uuid(),
	patch: z
		.object({
			contentId: z.uuid().optional(),
			episodeOrder: z.number().int().min(1).optional(),
			seasonNumber: z.number().int().min(1).nullable().optional(),
			episodeNumber: z.number().int().min(1).nullable().optional(),
			title: z.string().trim().min(1).nullable().optional(),
		})
		.refine(
			(value) => Object.keys(value).length > 0,
			"At least one field must be provided in patch"
		),
});

export const playlistAdminRemoveEpisodeInputSchema = z.object({
	id: z.uuid(),
});

export const playlistEpisodeContentSchema = z.object({
	id: z.uuid(),
	title: z.string(),
	description: z.string().nullable(),
	duration: z.number().int().nullable(),
	releaseDate: z.date().nullable(),
	contentType: z.enum(["MOVIE", "SERIES", "EPISODE", "MUSIC"]),
	thumbnailImageId: z.string().nullable(),
});

export const playlistEpisodeSchema = z.object({
	id: z.uuid(),
	playlistId: z.uuid(),
	contentId: z.uuid(),
	episodeOrder: z.number().int(),
	seasonNumber: z.number().int().nullable(),
	episodeNumber: z.number().int().nullable(),
	title: z.string().nullable(),
	addedAt: z.date(),
	content: playlistEpisodeContentSchema,
});

export const playlistEpisodeRowSchema = playlistEpisodeSchema.omit({
	content: true,
});

export const activePricingSchema = z
	.object({
		price: z.string(),
		currency: z.string(),
	})
	.nullable();

export const playlistSchema = z.object({
	id: z.uuid(),
	creatorId: z.string(),
	title: z.string(),
	description: z.string().nullable(),
	thumbnailImageId: z.string().nullable(),
	isSeries: z.boolean(),
	isPublished: z.boolean(),
	publishedAt: z.date().nullable(),
	isAvailable: z.boolean(),
	createdAt: z.date(),
	updatedAt: z.date(),
	activePricing: activePricingSchema.default(null),
});

export const playlistWithEpisodesOutputSchema = playlistSchema.extend({
	episodes: z.array(playlistEpisodeSchema),
});

export const playlistListOutputSchema = z.object({
	items: z.array(playlistSchema),
	pagination: z.object({
		page: z.number().int(),
		limit: z.number().int(),
		total: z.number().int(),
		totalPages: z.number().int(),
	}),
});

export const playlistDeleteOutputSchema = z.object({
	id: z.uuid(),
	deleted: z.literal(true),
});

export const playlistEpisodeDeleteOutputSchema = z.object({
	id: z.uuid(),
	playlistId: z.uuid(),
	deleted: z.literal(true),
});
