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
		.handler(async ({ context, input }) => {
			try {
				return await getPlaylistByIdWithEpisodes({
					db: context.db,
					input,
				});
			} catch (error) {
				mapPlaylistServiceError(error);
			}
		}),
	listEpisodes: publicProcedure
		.input(playlistListEpisodesInputSchema)
		.handler(async ({ context, input }) => {
			try {
				return await listPlaylistEpisodes({
					db: context.db,
					input,
				});
			} catch (error) {
				mapPlaylistServiceError(error);
			}
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
			try {
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
			} catch (error) {
				mapPlaylistServiceError(error);
			}
		}),
	adminReorderEpisodes: adminProcedure
		.input(playlistAdminReorderEpisodesInputSchema)
		.handler(async ({ context, input }) => {
			try {
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
			} catch (error) {
				mapPlaylistServiceError(error);
			}
		}),
});
