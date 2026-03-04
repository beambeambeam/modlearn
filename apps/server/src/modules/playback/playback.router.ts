import {
	createPlaybackSession,
	getPlaybackSession,
	recordPlaybackPause,
	recordPlaybackPlay,
	recordPlaybackResume,
	recordPlaybackSeek,
	recordPlaybackStop,
	refreshPlaybackSession,
} from "@/modules/playback/playback.service";
import {
	playbackCreateSessionInputSchema,
	playbackCreateSessionOutputSchema,
	playbackGetSessionInputSchema,
	playbackLifecycleOutputSchema,
	playbackPauseInputSchema,
	playbackPlayInputSchema,
	playbackRefreshSessionInputSchema,
	playbackRefreshSessionOutputSchema,
	playbackResumeInputSchema,
	playbackSeekInputSchema,
	playbackSessionStateOutputSchema,
	playbackStopInputSchema,
} from "@/modules/playback/playback.validators";
import { protectedProcedure, router } from "@/orpc";

export const playbackRouter = router({
	createSession: protectedProcedure
		.route({
			method: "POST",
			path: "/rpc/playback/createSession",
			tags: ["Playback"],
			summary: "Create playback session",
			description:
				"Requires authentication and ownership entitlement for the requested content.",
		})
		.input(playbackCreateSessionInputSchema)
		.output(playbackCreateSessionOutputSchema)
		.handler(({ context, input }) => {
			return createPlaybackSession({
				db: context.db,
				input: {
					userId: context.session.user.id,
					...input,
				},
			});
		}),
	play: protectedProcedure
		.route({
			method: "POST",
			path: "/rpc/playback/play",
			tags: ["Playback"],
			summary: "Record play event",
			description: "Requires authentication.",
		})
		.input(playbackPlayInputSchema)
		.output(playbackLifecycleOutputSchema)
		.handler(({ context, input }) => {
			return recordPlaybackPlay({
				db: context.db,
				input: {
					userId: context.session.user.id,
					...input,
				},
			});
		}),
	pause: protectedProcedure
		.route({
			method: "POST",
			path: "/rpc/playback/pause",
			tags: ["Playback"],
			summary: "Record pause event",
			description: "Requires authentication.",
		})
		.input(playbackPauseInputSchema)
		.output(playbackLifecycleOutputSchema)
		.handler(({ context, input }) => {
			return recordPlaybackPause({
				db: context.db,
				input: {
					userId: context.session.user.id,
					...input,
				},
			});
		}),
	resume: protectedProcedure
		.route({
			method: "POST",
			path: "/rpc/playback/resume",
			tags: ["Playback"],
			summary: "Record resume event",
			description: "Requires authentication.",
		})
		.input(playbackResumeInputSchema)
		.output(playbackLifecycleOutputSchema)
		.handler(({ context, input }) => {
			return recordPlaybackResume({
				db: context.db,
				input: {
					userId: context.session.user.id,
					...input,
				},
			});
		}),
	seek: protectedProcedure
		.route({
			method: "POST",
			path: "/rpc/playback/seek",
			tags: ["Playback"],
			summary: "Record seek event",
			description: "Requires authentication.",
		})
		.input(playbackSeekInputSchema)
		.output(playbackLifecycleOutputSchema)
		.handler(({ context, input }) => {
			return recordPlaybackSeek({
				db: context.db,
				input: {
					userId: context.session.user.id,
					...input,
				},
			});
		}),
	stop: protectedProcedure
		.route({
			method: "POST",
			path: "/rpc/playback/stop",
			tags: ["Playback"],
			summary: "Record stop event",
			description: "Requires authentication.",
		})
		.input(playbackStopInputSchema)
		.output(playbackLifecycleOutputSchema)
		.handler(({ context, input }) => {
			return recordPlaybackStop({
				db: context.db,
				input: {
					userId: context.session.user.id,
					...input,
				},
			});
		}),
	getSession: protectedProcedure
		.route({
			method: "POST",
			path: "/rpc/playback/getSession",
			tags: ["Playback"],
			summary: "Get playback session state",
			description: "Requires authentication.",
		})
		.input(playbackGetSessionInputSchema)
		.output(playbackSessionStateOutputSchema)
		.handler(({ context, input }) => {
			return getPlaybackSession({
				db: context.db,
				input: {
					userId: context.session.user.id,
					...input,
				},
			});
		}),
	refreshSession: protectedProcedure
		.route({
			method: "POST",
			path: "/rpc/playback/refreshSession",
			tags: ["Playback"],
			summary: "Refresh playback session token TTL",
			description: "Requires authentication.",
		})
		.input(playbackRefreshSessionInputSchema)
		.output(playbackRefreshSessionOutputSchema)
		.handler(({ context, input }) => {
			return refreshPlaybackSession({
				db: context.db,
				input: {
					userId: context.session.user.id,
					...input,
				},
			});
		}),
});
