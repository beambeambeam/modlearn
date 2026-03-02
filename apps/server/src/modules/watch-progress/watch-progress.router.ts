import {
	getWatchProgressResume,
	listContinueWatching,
	markWatchProgressCompleted,
	saveWatchProgress,
} from "@/modules/watch-progress/watch-progress.service";
import {
	watchProgressContinueWatchingInputSchema,
	watchProgressGetResumeInputSchema,
	watchProgressMarkCompletedInputSchema,
	watchProgressSaveInputSchema,
} from "@/modules/watch-progress/watch-progress.validators";
import { protectedProcedure, router } from "@/orpc";

export const watchProgressRouter = router({
	save: protectedProcedure
		.input(watchProgressSaveInputSchema)
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
		.input(watchProgressMarkCompletedInputSchema)
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
		.input(watchProgressGetResumeInputSchema)
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
		.input(watchProgressContinueWatchingInputSchema.optional())
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
