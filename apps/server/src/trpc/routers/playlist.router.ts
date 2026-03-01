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
import { adminProcedure, publicProcedure, router } from "../index";
import { logAdminMutation } from "./_audit";
import { mapPlaylistServiceError } from "./router.utils";

export const playlistRouter = router({
	getByIdWithEpisodes: publicProcedure
		.input(playlistByIdInputSchema)
		.query(async ({ ctx, input }) => {
			try {
				return await getPlaylistByIdWithEpisodes({
					db: ctx.db,
					input,
				});
			} catch (error) {
				mapPlaylistServiceError(error);
			}
		}),
	listEpisodes: publicProcedure
		.input(playlistListEpisodesInputSchema)
		.query(async ({ ctx, input }) => {
			try {
				return await listPlaylistEpisodes({
					db: ctx.db,
					input,
				});
			} catch (error) {
				mapPlaylistServiceError(error);
			}
		}),
	adminCreate: adminProcedure
		.input(playlistAdminCreateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const created = await createPlaylist({
				db: ctx.db,
				input,
				creatorId: ctx.session.user.id,
			});
			await logAdminMutation({
				ctx,
				entityType: "PLAYLIST",
				action: "CREATE",
				entityId: created.id,
			});
			return created;
		}),
	adminAddEpisode: adminProcedure
		.input(playlistAdminAddEpisodeInputSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				const added = await addEpisodeToPlaylist({
					db: ctx.db,
					input,
				});
				await logAdminMutation({
					ctx,
					entityType: "PLAYLIST_EPISODE",
					action: "ADD_EPISODE",
					entityId: added.id,
					metadata: {
						playlistId: added.playlistId,
						contentId: added.contentId,
					},
				});
				return added;
			} catch (error) {
				mapPlaylistServiceError(error);
			}
		}),
	adminReorderEpisodes: adminProcedure
		.input(playlistAdminReorderEpisodesInputSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				const reordered = await reorderPlaylistEpisodes({
					db: ctx.db,
					input,
				});
				await logAdminMutation({
					ctx,
					entityType: "PLAYLIST",
					action: "REORDER_EPISODES",
					entityId: input.playlistId,
					metadata: {
						episodeCount: reordered.length,
					},
				});
				return reordered;
			} catch (error) {
				mapPlaylistServiceError(error);
			}
		}),
});
