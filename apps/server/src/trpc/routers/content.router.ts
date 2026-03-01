import {
	createContent,
	deleteContent,
	getContentById,
	listContent,
	listPopularContent,
	setContentAvailability,
	setContentClassification,
	setContentPublishState,
	updateContent,
} from "@/modules/content/content.service";
import {
	contentAdminCreateInputSchema,
	contentAdminDeleteInputSchema,
	contentAdminSetAvailabilityInputSchema,
	contentAdminSetClassificationInputSchema,
	contentAdminSetPublishStateInputSchema,
	contentAdminUpdateInputSchema,
	contentByIdInputSchema,
	contentListInputSchema,
	contentListPopularInputSchema,
} from "@/modules/content/content.validators";
import { adminProcedure, publicProcedure, router } from "../index";
import { logAdminMutation } from "./_audit";
import { mapServiceError } from "./router.utils";

export const contentRouter = router({
	list: publicProcedure
		.input(contentListInputSchema.optional())
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
		.input(contentListPopularInputSchema.optional())
		.query(({ ctx, input }) => {
			return listPopularContent({
				db: ctx.db,
				input: contentListPopularInputSchema.parse(input ?? {}),
			});
		}),
	adminCreate: adminProcedure
		.input(contentAdminCreateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const created = await createContent({
				db: ctx.db,
				input,
				updatedBy: ctx.session.user.id,
			});
			await logAdminMutation({
				ctx,
				entityType: "CONTENT",
				action: "CREATE",
				entityId: created.id,
			});
			return created;
		}),
	adminUpdate: adminProcedure
		.input(contentAdminUpdateInputSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				const updated = await updateContent({
					db: ctx.db,
					input,
					updatedBy: ctx.session.user.id,
				});
				await logAdminMutation({
					ctx,
					entityType: "CONTENT",
					action: "UPDATE",
					entityId: updated.id,
					metadata: {
						patchKeys: Object.keys(input.patch),
					},
				});
				return updated;
			} catch (error) {
				mapServiceError(error);
			}
		}),
	adminSetPublishState: adminProcedure
		.input(contentAdminSetPublishStateInputSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				const updated = await setContentPublishState({
					db: ctx.db,
					input,
					updatedBy: ctx.session.user.id,
				});
				await logAdminMutation({
					ctx,
					entityType: "CONTENT",
					action: "SET_PUBLISH_STATE",
					entityId: updated.id,
					metadata: {
						isPublished: input.isPublished,
					},
				});
				return updated;
			} catch (error) {
				mapServiceError(error);
			}
		}),
	adminSetClassification: adminProcedure
		.input(contentAdminSetClassificationInputSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				const updated = await setContentClassification({
					db: ctx.db,
					input,
				});
				await logAdminMutation({
					ctx,
					entityType: "CONTENT",
					action: "SET_CLASSIFICATION",
					entityId: updated.contentId,
					metadata: {
						categoryIds: input.categoryIds,
						genreIds: input.genreIds,
					},
				});
				return updated;
			} catch (error) {
				mapServiceError(error);
			}
		}),
	adminDelete: adminProcedure
		.input(contentAdminDeleteInputSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				const deleted = await deleteContent({
					db: ctx.db,
					input,
					updatedBy: ctx.session.user.id,
				});
				await logAdminMutation({
					ctx,
					entityType: "CONTENT",
					action: "DELETE",
					entityId: deleted.id,
				});
				return deleted;
			} catch (error) {
				mapServiceError(error);
			}
		}),
	adminSetAvailability: adminProcedure
		.input(contentAdminSetAvailabilityInputSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				const updated = await setContentAvailability({
					db: ctx.db,
					input,
					updatedBy: ctx.session.user.id,
				});
				await logAdminMutation({
					ctx,
					entityType: "CONTENT",
					action: "SET_AVAILABILITY",
					entityId: updated.id,
					metadata: {
						isAvailable: input.isAvailable,
					},
				});
				return updated;
			} catch (error) {
				mapServiceError(error);
			}
		}),
});
