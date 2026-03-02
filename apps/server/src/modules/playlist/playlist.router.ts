import { z } from "zod";
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
	playlistEpisodeRowSchema,
	playlistEpisodeSchema,
	playlistListEpisodesInputSchema,
	playlistSchema,
	playlistWithEpisodesOutputSchema,
} from "@/modules/playlist/playlist.validators";
import { adminProcedure, publicProcedure, router } from "@/orpc";

export const playlistRouter = router({
	getByIdWithEpisodes: publicProcedure
		.route({
			method: "POST",
			path: "/rpc/playlist/getByIdWithEpisodes",
			tags: ["Playlist"],
			summary: "Get playlist with episodes",
		})
		.input(playlistByIdInputSchema)
		.output(playlistWithEpisodesOutputSchema)
		.handler(({ context, input }) => {
			return getPlaylistByIdWithEpisodes({
				db: context.db,
				input,
			});
		}),
	listEpisodes: publicProcedure
		.route({
			method: "POST",
			path: "/rpc/playlist/listEpisodes",
			tags: ["Playlist"],
			summary: "List playlist episodes",
		})
		.input(playlistListEpisodesInputSchema)
		.output(z.array(playlistEpisodeSchema))
		.handler(({ context, input }) => {
			return listPlaylistEpisodes({
				db: context.db,
				input,
			});
		}),
	adminCreate: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/playlist/adminCreate",
			tags: ["Playlist"],
			summary: "Create playlist",
			description: "Requires admin or superadmin role.",
		})
		.input(playlistAdminCreateInputSchema)
		.output(playlistSchema)
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
		.route({
			method: "POST",
			path: "/rpc/playlist/adminAddEpisode",
			tags: ["Playlist"],
			summary: "Add episode to playlist",
			description: "Requires admin or superadmin role.",
		})
		.input(playlistAdminAddEpisodeInputSchema)
		.output(playlistEpisodeRowSchema)
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
		.route({
			method: "POST",
			path: "/rpc/playlist/adminReorderEpisodes",
			tags: ["Playlist"],
			summary: "Reorder playlist episodes",
			description: "Requires admin or superadmin role.",
		})
		.input(playlistAdminReorderEpisodesInputSchema)
		.output(z.array(playlistEpisodeRowSchema))
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
