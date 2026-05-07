import {
	getCourseAutoPlayNext,
	getCourseWatchProgressResume,
	getWatchProgressResume,
	listContinueWatching,
	markWatchProgressCompleted,
	saveWatchProgress,
} from "@/modules/watch-progress/watch-progress.service";
import {
	continueWatchingOutputSchema,
	courseAutoPlayNextOutputSchema,
	courseWatchProgressResumeOutputSchema,
	watchProgressContinueWatchingInputSchema,
	watchProgressEnvelopeSchema,
	watchProgressGetCourseAutoPlayNextInputSchema,
	watchProgressGetCourseResumeInputSchema,
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
				"Requires authentication. Marks watch progress as completed for the specified lesson.",
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
				"Requires authentication. Returns resume position for the specified lesson.",
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
	getCourseResume: protectedProcedure
		.route({
			method: "POST",
			path: "/rpc/watchProgress/getCourseResume",
			tags: ["Watch Progress User"],
			summary: "Retrieve Course Resume Target",
			description:
				"Requires authentication. Returns the next resume target within a course.",
		})
		.input(watchProgressGetCourseResumeInputSchema)
		.output(courseWatchProgressResumeOutputSchema)
		.handler(({ context, input }) => {
			return getCourseWatchProgressResume({
				db: context.db,
				input: {
					userId: context.session.user.id,
					...input,
				},
			});
		}),
	getCourseAutoPlayNext: protectedProcedure
		.route({
			method: "POST",
			path: "/rpc/watchProgress/getCourseAutoPlayNext",
			tags: ["Watch Progress User"],
			summary: "Retrieve Course Auto-Play Next Lesson",
			description:
				"Requires authentication. Returns the next lesson candidate for course auto-play.",
		})
		.input(watchProgressGetCourseAutoPlayNextInputSchema)
		.output(courseAutoPlayNextOutputSchema)
		.handler(({ context, input }) => {
			return getCourseAutoPlayNext({
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
