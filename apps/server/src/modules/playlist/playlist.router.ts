import { logAdminMutation } from "@/modules/admin-audit/admin-audit.service";
import {
	addEpisodeToPlaylist,
	createPlaylist,
	getPlaylistByIdWithEpisodes,
	listPlaylistEpisodes,
	reorderPlaylistEpisodes,
} from "@/modules/playlist/playlist.service";
import {
	playlistAdminAddEpisodeInputSchema,
	playlistAdminCreateInputSchema,
	playlistAdminReorderEpisodesInputSchema,
	playlistByIdInputSchema,
	playlistListEpisodesInputSchema,
} from "@/modules/playlist/playlist.validators";
import { adminProcedure, publicProcedure, router } from "@/orpc";

export const playlistRouter = router({
	getByIdWithEpisodes: publicProcedure
		.input(playlistByIdInputSchema)
		.handler(({ context, input }) => {
			return getPlaylistByIdWithEpisodes({
				db: context.db,
				input,
			});
		}),
	listEpisodes: publicProcedure
		.input(playlistListEpisodesInputSchema)
		.handler(({ context, input }) => {
			return listPlaylistEpisodes({
				db: context.db,
				input,
			});
		}),
	adminCreate: adminProcedure
		.input(playlistAdminCreateInputSchema)
		.handler(async ({ context, input }) => {
			const created = await createPlaylist({
				db: context.db,
				input,
				creatorId: context.session.user.id,
			});
			await logAdminMutation({
				context,
				entityType: "PLAYLIST",
				action: "CREATE",
				entityId: created.id,
			});
			return created;
		}),
	adminAddEpisode: adminProcedure
		.input(playlistAdminAddEpisodeInputSchema)
		.handler(async ({ context, input }) => {
			const added = await addEpisodeToPlaylist({
				db: context.db,
				input,
			});
			await logAdminMutation({
				context,
				entityType: "PLAYLIST_EPISODE",
				action: "ADD_EPISODE",
				entityId: added.id,
				metadata: {
					playlistId: added.playlistId,
					contentId: added.contentId,
				},
			});
			return added;
		}),
	adminReorderEpisodes: adminProcedure
		.input(playlistAdminReorderEpisodesInputSchema)
		.handler(async ({ context, input }) => {
			const reordered = await reorderPlaylistEpisodes({
				db: context.db,
				input,
			});
			await logAdminMutation({
				context,
				entityType: "PLAYLIST",
				action: "REORDER_EPISODES",
				entityId: input.playlistId,
				metadata: {
					episodeCount: reordered.length,
				},
			});
			return reordered;
		}),
});
