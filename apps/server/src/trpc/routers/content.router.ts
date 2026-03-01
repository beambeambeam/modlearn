import { TRPCError } from "@trpc/server";
import {
	createContent,
	getContentById,
	listContent,
	listPopularContent,
	setContentPublishState,
	updateContent,
} from "@/modules/content/content.service";
import { ContentNotFoundError } from "@/modules/content/content.types";
import {
	contentAdminCreateInputSchema,
	contentAdminSetPublishStateInputSchema,
	contentAdminUpdateInputSchema,
	contentByIdInputSchema,
	contentListInputSchema,
	contentListPopularInputSchema,
} from "@/modules/content/content.validators";
import { adminProcedure, publicProcedure, router } from "../index";

function mapServiceError(error: unknown): never {
	if (error instanceof ContentNotFoundError) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: error.message,
		});
	}

	throw error;
}

export const contentRouter = router({
	list: publicProcedure
		.input(contentListInputSchema.partial().optional())
		.query(({ ctx, input }) => {
			return listContent({
				db: ctx.db,
				input: contentListInputSchema.parse(input ?? {}),
			});
		}),
	getById: publicProcedure
		.input(contentByIdInputSchema)
		.query(async ({ ctx, input }) => {
			try {
				return await getContentById({
					db: ctx.db,
					input,
				});
			} catch (error) {
				mapServiceError(error);
			}
		}),
	listPopular: publicProcedure
		.input(contentListPopularInputSchema.partial().optional())
		.query(({ ctx, input }) => {
			return listPopularContent({
				db: ctx.db,
				input: contentListPopularInputSchema.parse(input ?? {}),
			});
		}),
	adminCreate: adminProcedure
		.input(contentAdminCreateInputSchema)
		.mutation(({ ctx, input }) => {
			return createContent({
				db: ctx.db,
				input,
				updatedBy: ctx.session.user.id,
			});
		}),
	adminUpdate: adminProcedure
		.input(contentAdminUpdateInputSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				return await updateContent({
					db: ctx.db,
					input,
					updatedBy: ctx.session.user.id,
				});
			} catch (error) {
				mapServiceError(error);
			}
		}),
	adminSetPublishState: adminProcedure
		.input(contentAdminSetPublishStateInputSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				return await setContentPublishState({
					db: ctx.db,
					input,
					updatedBy: ctx.session.user.id,
				});
			} catch (error) {
				mapServiceError(error);
			}
		}),
});
