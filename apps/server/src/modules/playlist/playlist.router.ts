import { z } from "zod";
import { logAdminMutation } from "@/modules/admin-audit/admin-audit.service";
import {
	addEpisodeToPlaylist,
	createPlaylist,
	deletePlaylist,
	getPlaylistByIdWithEpisodes,
	listPlaylistEpisodes,
	listPlaylists,
	removeEpisodeFromPlaylist,
	reorderPlaylistEpisodes,
	updatePlaylist,
	updatePlaylistEpisode,
} from "@/modules/playlist/playlist.service";
import {
	playlistAdminAddEpisodeInputSchema,
	playlistAdminCreateInputSchema,
	playlistAdminDeleteInputSchema,
	playlistAdminRemoveEpisodeInputSchema,
	playlistAdminReorderEpisodesInputSchema,
	playlistAdminUpdateEpisodeInputSchema,
	playlistAdminUpdateInputSchema,
	playlistByIdInputSchema,
	playlistDeleteOutputSchema,
	playlistEpisodeDeleteOutputSchema,
	playlistEpisodeRowSchema,
	playlistEpisodeSchema,
	playlistListEpisodesInputSchema,
	playlistListInputSchema,
	playlistListOutputSchema,
	playlistSchema,
	playlistWithEpisodesOutputSchema,
} from "@/modules/playlist/playlist.validators";
import { adminProcedure, publicProcedure, router } from "@/orpc";

export const playlistRouter = router({
	list: publicProcedure
		.route({
			method: "POST",
			path: "/rpc/playlist/list",
			tags: ["Playlist"],
			summary: "List playlists",
		})
		.input(playlistListInputSchema.optional())
		.output(playlistListOutputSchema)
		.handler(({ context, input }) => {
			return listPlaylists({
				db: context.db,
				input: playlistListInputSchema.parse(input ?? {}),
			});
		}),
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
	adminUpdate: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/playlist/adminUpdate",
			tags: ["Playlist"],
			summary: "Update playlist",
			description: "Requires admin or superadmin role.",
		})
		.input(playlistAdminUpdateInputSchema)
		.output(playlistSchema)
		.handler(async ({ context, input }) => {
			const updated = await updatePlaylist({
				db: context.db,
				input,
			});
			await logAdminMutation({
				context,
				entityType: "PLAYLIST",
				action: "UPDATE",
				entityId: updated.id,
				metadata: {
					patchKeys: Object.keys(input.patch),
				},
			});
			return updated;
		}),
	adminDelete: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/playlist/adminDelete",
			tags: ["Playlist"],
			summary: "Delete playlist",
			description: "Requires admin or superadmin role.",
		})
		.input(playlistAdminDeleteInputSchema)
		.output(playlistDeleteOutputSchema)
		.handler(async ({ context, input }) => {
			const deleted = await deletePlaylist({
				db: context.db,
				input,
			});
			await logAdminMutation({
				context,
				entityType: "PLAYLIST",
				action: "DELETE",
				entityId: deleted.id,
			});
			return deleted;
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
	adminUpdateEpisode: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/playlist/adminUpdateEpisode",
			tags: ["Playlist"],
			summary: "Update playlist episode",
			description: "Requires admin or superadmin role.",
		})
		.input(playlistAdminUpdateEpisodeInputSchema)
		.output(playlistEpisodeRowSchema)
		.handler(async ({ context, input }) => {
			const updated = await updatePlaylistEpisode({
				db: context.db,
				input,
			});
			await logAdminMutation({
				context,
				entityType: "PLAYLIST_EPISODE",
				action: "UPDATE_EPISODE",
				entityId: updated.id,
				metadata: {
					playlistId: updated.playlistId,
					patchKeys: Object.keys(input.patch),
				},
			});
			return updated;
		}),
	adminRemoveEpisode: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/playlist/adminRemoveEpisode",
			tags: ["Playlist"],
			summary: "Remove playlist episode",
			description: "Requires admin or superadmin role.",
		})
		.input(playlistAdminRemoveEpisodeInputSchema)
		.output(playlistEpisodeDeleteOutputSchema)
		.handler(async ({ context, input }) => {
			const deleted = await removeEpisodeFromPlaylist({
				db: context.db,
				input,
			});
			await logAdminMutation({
				context,
				entityType: "PLAYLIST_EPISODE",
				action: "REMOVE_EPISODE",
				entityId: deleted.id,
				metadata: {
					playlistId: deleted.playlistId,
				},
			});
			return deleted;
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
