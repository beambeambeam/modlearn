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
import { protectedProcedure, router } from "../index";
import { mapWatchProgressError } from "./router.utils";

export const watchProgressRouter = router({
	save: protectedProcedure
		.input(watchProgressSaveInputSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				return await saveWatchProgress({
					db: ctx.db,
					input: {
						userId: ctx.session.user.id,
						...input,
					},
				});
			} catch (error) {
				mapWatchProgressError(error);
			}
		}),
	markCompleted: protectedProcedure
		.input(watchProgressMarkCompletedInputSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				return await markWatchProgressCompleted({
					db: ctx.db,
					input: {
						userId: ctx.session.user.id,
						...input,
					},
				});
			} catch (error) {
				mapWatchProgressError(error);
			}
		}),
	getResume: protectedProcedure
		.input(watchProgressGetResumeInputSchema)
		.query(async ({ ctx, input }) => {
			try {
				return await getWatchProgressResume({
					db: ctx.db,
					input: {
						userId: ctx.session.user.id,
						...input,
					},
				});
			} catch (error) {
				mapWatchProgressError(error);
			}
		}),
	continueWatching: protectedProcedure
		.input(watchProgressContinueWatchingInputSchema.optional())
		.query(async ({ ctx, input }) => {
			try {
				return await listContinueWatching({
					db: ctx.db,
					input: {
						userId: ctx.session.user.id,
						...watchProgressContinueWatchingInputSchema.parse(input ?? {}),
					},
				});
			} catch (error) {
				mapWatchProgressError(error);
			}
		}),
});
