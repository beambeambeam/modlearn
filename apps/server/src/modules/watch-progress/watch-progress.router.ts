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
import { mapWatchProgressError } from "@/orpc/routers/router.utils";

export const watchProgressRouter = router({
	save: protectedProcedure
		.input(watchProgressSaveInputSchema)
		.handler(async ({ context, input }) => {
			try {
				return await saveWatchProgress({
					db: context.db,
					input: {
						userId: context.session.user.id,
						...input,
					},
				});
			} catch (error) {
				mapWatchProgressError(error);
			}
		}),
	markCompleted: protectedProcedure
		.input(watchProgressMarkCompletedInputSchema)
		.handler(async ({ context, input }) => {
			try {
				return await markWatchProgressCompleted({
					db: context.db,
					input: {
						userId: context.session.user.id,
						...input,
					},
				});
			} catch (error) {
				mapWatchProgressError(error);
			}
		}),
	getResume: protectedProcedure
		.input(watchProgressGetResumeInputSchema)
		.handler(async ({ context, input }) => {
			try {
				return await getWatchProgressResume({
					db: context.db,
					input: {
						userId: context.session.user.id,
						...input,
					},
				});
			} catch (error) {
				mapWatchProgressError(error);
			}
		}),
	continueWatching: protectedProcedure
		.input(watchProgressContinueWatchingInputSchema.optional())
		.handler(async ({ context, input }) => {
			try {
				return await listContinueWatching({
					db: context.db,
					input: {
						userId: context.session.user.id,
						...watchProgressContinueWatchingInputSchema.parse(input ?? {}),
					},
				});
			} catch (error) {
				mapWatchProgressError(error);
			}
		}),
});
