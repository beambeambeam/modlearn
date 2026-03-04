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
	setPlaylistAvailability,
	setPlaylistPublishState,
	updatePlaylist,
	updatePlaylistEpisode,
} from "@/modules/playlist/playlist.service";
import {
	playlistAdminAddEpisodeInputSchema,
	playlistAdminByIdInputSchema,
	playlistAdminCreateInputSchema,
	playlistAdminDeleteInputSchema,
	playlistAdminListInputSchema,
	playlistAdminRemoveEpisodeInputSchema,
	playlistAdminReorderEpisodesInputSchema,
	playlistAdminSetAvailabilityInputSchema,
	playlistAdminSetPublishStateInputSchema,
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
			tags: ["Playlist Public"],
			summary: "List Available Public Playlists",
			description:
				"Public endpoint. Returns only playlists that are both published and available.",
		})
		.input(playlistListInputSchema.optional())
		.output(playlistListOutputSchema)
		.handler(({ context, input }) => {
			const parsedInput = playlistListInputSchema.parse(input ?? {});
			return listPlaylists({
				db: context.db,
				input: {
					...parsedInput,
					onlyPublished: true,
				},
			});
		}),
	getByIdWithEpisodes: publicProcedure
		.route({
			method: "POST",
			path: "/rpc/playlist/getByIdWithEpisodes",
			tags: ["Playlist Public"],
			summary: "Retrieve Available Public Playlist With Episodes",
			description:
				"Public endpoint. Returns a published and available playlist with its visible episodes.",
		})
		.input(playlistByIdInputSchema)
		.output(playlistWithEpisodesOutputSchema)
		.handler(({ context, input }) => {
			return getPlaylistByIdWithEpisodes({
				db: context.db,
				input: {
					...input,
					onlyPublished: true,
				},
			});
		}),
	listEpisodes: publicProcedure
		.route({
			method: "POST",
			path: "/rpc/playlist/listEpisodes",
			tags: ["Playlist Public"],
			summary: "List Public Playlist Episodes",
			description:
				"Public endpoint. Returns playlist episodes visible to public consumers.",
		})
		.input(playlistListEpisodesInputSchema)
		.output(z.array(playlistEpisodeSchema))
		.handler(({ context, input }) => {
			return listPlaylistEpisodes({
				db: context.db,
				input,
			});
		}),
	adminList: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/playlist/adminList",
			tags: ["Playlist Admin"],
			summary: "List Admin Playlists",
			description:
				"Requires admin or superadmin role. Can return published, unpublished, available, or unavailable playlists.",
		})
		.input(playlistAdminListInputSchema.optional())
		.output(playlistListOutputSchema)
		.handler(({ context, input }) => {
			return listPlaylists({
				db: context.db,
				input: playlistAdminListInputSchema.parse(input ?? {}),
			});
		}),
	adminGetByIdWithEpisodes: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/playlist/adminGetByIdWithEpisodes",
			tags: ["Playlist Admin"],
			summary: "Retrieve Admin Playlist Details With Episodes",
			description:
				"Requires admin or superadmin role. Can include unpublished or unavailable playlists and episodes.",
		})
		.input(playlistAdminByIdInputSchema)
		.output(playlistWithEpisodesOutputSchema)
		.handler(({ context, input }) => {
			return getPlaylistByIdWithEpisodes({
				db: context.db,
				input,
			});
		}),
	adminCreate: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/playlist/adminCreate",
			tags: ["Playlist Admin"],
			summary: "Create Playlist",
			description: "Requires admin or superadmin role. Creates a new playlist.",
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
			tags: ["Playlist Admin"],
			summary: "Update Playlist",
			description:
				"Requires admin or superadmin role. Updates mutable playlist fields.",
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
			tags: ["Playlist Admin"],
			summary: "Delete Playlist",
			description:
				"Requires admin or superadmin role. Deletes a playlist and returns deletion metadata.",
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
	adminSetPublishState: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/playlist/adminSetPublishState",
			tags: ["Playlist Admin"],
			summary: "Set Playlist Publish State",
			description:
				"Requires admin or superadmin role. Sets whether a playlist is published.",
		})
		.input(playlistAdminSetPublishStateInputSchema)
		.output(playlistSchema)
		.handler(async ({ context, input }) => {
			const updated = await setPlaylistPublishState({
				db: context.db,
				input,
			});
			await logAdminMutation({
				context,
				entityType: "PLAYLIST",
				action: "SET_PUBLISH_STATE",
				entityId: updated.id,
				metadata: {
					isPublished: input.isPublished,
				},
			});
			return updated;
		}),
	adminSetAvailability: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/playlist/adminSetAvailability",
			tags: ["Playlist Admin"],
			summary: "Set Playlist Availability State",
			description:
				"Requires admin or superadmin role. Sets whether a playlist is available.",
		})
		.input(playlistAdminSetAvailabilityInputSchema)
		.output(playlistSchema)
		.handler(async ({ context, input }) => {
			const updated = await setPlaylistAvailability({
				db: context.db,
				input,
			});
			await logAdminMutation({
				context,
				entityType: "PLAYLIST",
				action: "SET_AVAILABILITY",
				entityId: updated.id,
				metadata: {
					isAvailable: input.isAvailable,
				},
			});
			return updated;
		}),
	adminAddEpisode: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/playlist/adminAddEpisode",
			tags: ["Playlist Admin"],
			summary: "Add Episode To Playlist",
			description:
				"Requires admin or superadmin role. Adds a content episode to a playlist.",
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
			tags: ["Playlist Admin"],
			summary: "Update Playlist Episode",
			description:
				"Requires admin or superadmin role. Updates mutable playlist episode fields.",
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
			tags: ["Playlist Admin"],
			summary: "Remove Episode From Playlist",
			description:
				"Requires admin or superadmin role. Removes an episode from a playlist.",
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
			tags: ["Playlist Admin"],
			summary: "Reorder Playlist Episodes",
			description:
				"Requires admin or superadmin role. Reorders episodes within a playlist.",
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
