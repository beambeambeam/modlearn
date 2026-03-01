import { TRPCError } from "@trpc/server";
import {
	addEpisodeToPlaylist,
	createPlaylist,
	getPlaylistByIdWithEpisodes,
	listPlaylistEpisodes,
	reorderPlaylistEpisodes,
} from "@/modules/playlist/playlist.service";
import {
	ContentNotFoundError,
	PlaylistNotFoundError,
	PlaylistReorderValidationError,
} from "@/modules/playlist/playlist.types";
import {
	playlistAdminAddEpisodeInputSchema,
	playlistAdminCreateInputSchema,
	playlistAdminReorderEpisodesInputSchema,
	playlistByIdInputSchema,
	playlistListEpisodesInputSchema,
} from "@/modules/playlist/playlist.validators";
import { adminProcedure, publicProcedure, router } from "../index";

function mapPlaylistServiceError(error: unknown): never {
	if (
		error instanceof PlaylistNotFoundError ||
		error instanceof ContentNotFoundError
	) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: error.message,
		});
	}

	if (error instanceof PlaylistReorderValidationError) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: error.message,
		});
	}

	throw error;
}

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
		.mutation(({ ctx, input }) => {
			return createPlaylist({
				db: ctx.db,
				input,
				creatorId: ctx.session.user.id,
			});
		}),
	adminAddEpisode: adminProcedure
		.input(playlistAdminAddEpisodeInputSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				return await addEpisodeToPlaylist({
					db: ctx.db,
					input,
				});
			} catch (error) {
				mapPlaylistServiceError(error);
			}
		}),
	adminReorderEpisodes: adminProcedure
		.input(playlistAdminReorderEpisodesInputSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				return await reorderPlaylistEpisodes({
					db: ctx.db,
					input,
				});
			} catch (error) {
				mapPlaylistServiceError(error);
			}
		}),
});
