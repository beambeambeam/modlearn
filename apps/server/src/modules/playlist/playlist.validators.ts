import { z } from "zod";

export const playlistByIdInputSchema = z.object({
	id: z.uuid(),
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
