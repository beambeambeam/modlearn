import { z } from "zod";

export const libraryListMyItemsInputSchema = z.object({
	page: z.number().int().min(1).default(1),
	limit: z.number().int().min(1).max(50).default(20),
});

export const libraryGetPlaylistCollectionInputSchema = z.object({
	playlistId: z.uuid(),
});

export const libraryHasAccessInputSchema = z
	.object({
		contentId: z.uuid().optional(),
		playlistId: z.uuid().optional(),
	})
	.superRefine((value, ctx) => {
		const provided =
			Number(Boolean(value.contentId)) + Number(Boolean(value.playlistId));
		if (provided !== 1) {
			ctx.addIssue({
				code: "custom",
				message: "Exactly one of contentId or playlistId must be provided",
				path: ["contentId"],
			});
		}
	});

export const libraryContentSummarySchema = z.object({
	id: z.uuid(),
	title: z.string(),
	description: z.string().nullable(),
	duration: z.number().int().nullable(),
	releaseDate: z.date().nullable(),
	contentType: z.enum(["MOVIE", "SERIES", "EPISODE", "MUSIC"]),
	thumbnailImageId: z.string().nullable(),
});

export const libraryPlaylistSummarySchema = z.object({
	id: z.uuid(),
	creatorId: z.string(),
	title: z.string(),
	description: z.string().nullable(),
	thumbnailImageId: z.string().nullable(),
	isSeries: z.boolean(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const libraryPlaylistEpisodeSchema = z.object({
	id: z.uuid(),
	playlistId: z.uuid(),
	contentId: z.uuid(),
	episodeOrder: z.number().int(),
	seasonNumber: z.number().int().nullable(),
	episodeNumber: z.number().int().nullable(),
	title: z.string().nullable(),
	addedAt: z.date(),
	content: libraryContentSummarySchema,
});

export const libraryContentItemSchema = z.object({
	type: z.literal("CONTENT"),
	acquiredAt: z.date(),
	expiresAt: z.date().nullable(),
	orderId: z.uuid(),
	content: libraryContentSummarySchema,
});

export const libraryPlaylistCollectionSchema = z.object({
	type: z.literal("PLAYLIST_COLLECTION"),
	acquiredAt: z.date(),
	expiresAt: z.date().nullable(),
	orderId: z.uuid(),
	playlist: libraryPlaylistSummarySchema,
	episodes: z.array(libraryPlaylistEpisodeSchema),
});

export const libraryItemSchema = z.discriminatedUnion("type", [
	libraryContentItemSchema,
	libraryPlaylistCollectionSchema,
]);

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
