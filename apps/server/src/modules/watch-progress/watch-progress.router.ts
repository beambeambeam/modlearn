import {
	getWatchProgressResume,
	listContinueWatching,
	markWatchProgressCompleted,
	saveWatchProgress,
} from "@/modules/watch-progress/watch-progress.service";
import {
	continueWatchingOutputSchema,
	watchProgressContinueWatchingInputSchema,
	watchProgressEnvelopeSchema,
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
			tags: ["Watch Progress"],
			summary: "Save watch progress",
			description: "Requires authentication.",
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
			tags: ["Watch Progress"],
			summary: "Mark progress completed",
			description: "Requires authentication.",
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
			tags: ["Watch Progress"],
			summary: "Get resume position",
			description: "Requires authentication.",
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
	continueWatching: protectedProcedure
		.route({
			method: "POST",
			path: "/rpc/watchProgress/continueWatching",
			tags: ["Watch Progress"],
			summary: "List continue watching",
			description: "Requires authentication.",
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
