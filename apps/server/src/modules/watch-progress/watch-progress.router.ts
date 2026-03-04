import {
	getPlaylistAutoPlayNext,
	getPlaylistWatchProgressResume,
	getWatchProgressResume,
	listContinueWatching,
	markWatchProgressCompleted,
	saveWatchProgress,
} from "@/modules/watch-progress/watch-progress.service";
import {
	continueWatchingOutputSchema,
	playlistAutoPlayNextOutputSchema,
	playlistWatchProgressResumeOutputSchema,
	watchProgressContinueWatchingInputSchema,
	watchProgressEnvelopeSchema,
	watchProgressGetPlaylistAutoPlayNextInputSchema,
	watchProgressGetPlaylistResumeInputSchema,
	watchProgressGetResumeInputSchema,
	watchProgressMarkCompletedInputSchema,
	watchProgressResumeOutputSchema,
	watchProgressSaveInputSchema,
} from "@/modules/watch-progress/watch-progress.validators";
import { protectedProcedure, router } from "@/orpc";

export const watchProgressRouter = router({
	save: protectedProcedure
		.route({
			method: "POST",
			path: "/rpc/watchProgress/save",
			tags: ["Watch Progress User"],
			summary: "Save Watch Progress",
			description:
				"Requires authentication. Upserts watch progress for the signed-in user.",
		})
		.input(watchProgressSaveInputSchema)
		.output(watchProgressEnvelopeSchema)
		.handler(({ context, input }) => {
			return saveWatchProgress({
				db: context.db,
				input: {
					userId: context.session.user.id,
					...input,
				},
			});
		}),
	markCompleted: protectedProcedure
		.route({
			method: "POST",
			path: "/rpc/watchProgress/markCompleted",
			tags: ["Watch Progress User"],
			summary: "Mark Watch Progress As Completed",
			description:
				"Requires authentication. Marks watch progress as completed for the specified item.",
		})
		.input(watchProgressMarkCompletedInputSchema)
		.output(watchProgressEnvelopeSchema)
		.handler(({ context, input }) => {
			return markWatchProgressCompleted({
				db: context.db,
				input: {
					userId: context.session.user.id,
					...input,
				},
			});
		}),
	getResume: protectedProcedure
		.route({
			method: "POST",
			path: "/rpc/watchProgress/getResume",
			tags: ["Watch Progress User"],
			summary: "Retrieve Watch Resume Position",
			description:
				"Requires authentication. Returns resume position for the specified content.",
		})
		.input(watchProgressGetResumeInputSchema)
		.output(watchProgressResumeOutputSchema)
		.handler(({ context, input }) => {
			return getWatchProgressResume({
				db: context.db,
				input: {
					userId: context.session.user.id,
					...input,
				},
			});
		}),
	getPlaylistResume: protectedProcedure
		.route({
			method: "POST",
			path: "/rpc/watchProgress/getPlaylistResume",
			tags: ["Watch Progress User"],
			summary: "Retrieve Playlist Resume Target",
			description:
				"Requires authentication. Returns the next resume target within a playlist.",
		})
		.input(watchProgressGetPlaylistResumeInputSchema)
		.output(playlistWatchProgressResumeOutputSchema)
		.handler(({ context, input }) => {
			return getPlaylistWatchProgressResume({
				db: context.db,
				input: {
					userId: context.session.user.id,
					...input,
				},
			});
		}),
	getPlaylistAutoPlayNext: protectedProcedure
		.route({
			method: "POST",
			path: "/rpc/watchProgress/getPlaylistAutoPlayNext",
			tags: ["Watch Progress User"],
			summary: "Retrieve Playlist Auto-Play Next Episode",
			description:
				"Requires authentication. Returns the next episode candidate for playlist auto-play.",
		})
		.input(watchProgressGetPlaylistAutoPlayNextInputSchema)
		.output(playlistAutoPlayNextOutputSchema)
		.handler(({ context, input }) => {
			return getPlaylistAutoPlayNext({
				db: context.db,
				input: {
					userId: context.session.user.id,
					...input,
				},
			});
		}),
	continueWatching: protectedProcedure
		.route({
			method: "POST",
			path: "/rpc/watchProgress/continueWatching",
			tags: ["Watch Progress User"],
			summary: "List Continue Watching Items",
			description:
				"Requires authentication. Returns continue-watching rows for the signed-in user.",
		})
		.input(watchProgressContinueWatchingInputSchema.optional())
		.output(continueWatchingOutputSchema)
		.handler(({ context, input }) => {
			return listContinueWatching({
				db: context.db,
				input: {
					userId: context.session.user.id,
					...watchProgressContinueWatchingInputSchema.parse(input ?? {}),
				},
			});
		}),
});
