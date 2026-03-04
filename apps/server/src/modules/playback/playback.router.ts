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
			tags: ["Playback User"],
			summary: "Create Playback Session",
			description:
				"Requires authentication. Creates a playback session when the user has entitlement for the requested content.",
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
			tags: ["Playback User"],
			summary: "Record Playback Play Event",
			description:
				"Requires authentication. Records a play lifecycle event for the current user session.",
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
			tags: ["Playback User"],
			summary: "Record Playback Pause Event",
			description:
				"Requires authentication. Records a pause lifecycle event for the current user session.",
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
			tags: ["Playback User"],
			summary: "Record Playback Resume Event",
			description:
				"Requires authentication. Records a resume lifecycle event for the current user session.",
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
			tags: ["Playback User"],
			summary: "Record Playback Seek Event",
			description:
				"Requires authentication. Records a seek lifecycle event for the current user session.",
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
			tags: ["Playback User"],
			summary: "Record Playback Stop Event",
			description:
				"Requires authentication. Records a stop lifecycle event for the current user session.",
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
			tags: ["Playback User"],
			summary: "Retrieve Playback Session State",
			description:
				"Requires authentication. Returns playback session state for the signed-in user.",
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
			tags: ["Playback User"],
			summary: "Refresh Playback Session Token TTL",
			description:
				"Requires authentication. Extends playback session token TTL for an active session.",
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
