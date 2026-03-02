import { logAdminMutation } from "@/modules/admin-audit/admin-audit.service";
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
import { adminProcedure, publicProcedure, router } from "@/orpc";

export const contentRouter = router({
	list: publicProcedure
		.input(contentListInputSchema.optional())
		.handler(({ context, input }) => {
			return listContent({
				db: context.db,
				input: contentListInputSchema.parse(input ?? {}),
			});
		}),
	getById: publicProcedure
		.input(contentByIdInputSchema)
		.handler(({ context, input }) => {
			return getContentById({
				db: context.db,
				input,
			});
		}),
	listPopular: publicProcedure
		.input(contentListPopularInputSchema.optional())
		.handler(({ context, input }) => {
			return listPopularContent({
				db: context.db,
				input: contentListPopularInputSchema.parse(input ?? {}),
			});
		}),
	adminCreate: adminProcedure
		.input(contentAdminCreateInputSchema)
		.handler(async ({ context, input }) => {
			const created = await createContent({
				db: context.db,
				input,
				updatedBy: context.session.user.id,
			});
			await logAdminMutation({
				context,
				entityType: "CONTENT",
				action: "CREATE",
				entityId: created.id,
			});
			return created;
		}),
	adminUpdate: adminProcedure
		.input(contentAdminUpdateInputSchema)
		.handler(async ({ context, input }) => {
			const updated = await updateContent({
				db: context.db,
				input,
				updatedBy: context.session.user.id,
			});
			await logAdminMutation({
				context,
				entityType: "CONTENT",
				action: "UPDATE",
				entityId: updated.id,
				metadata: {
					patchKeys: Object.keys(input.patch),
				},
			});
			return updated;
		}),
	adminSetPublishState: adminProcedure
		.input(contentAdminSetPublishStateInputSchema)
		.handler(async ({ context, input }) => {
			const updated = await setContentPublishState({
				db: context.db,
				input,
				updatedBy: context.session.user.id,
			});
			await logAdminMutation({
				context,
				entityType: "CONTENT",
				action: "SET_PUBLISH_STATE",
				entityId: updated.id,
				metadata: {
					isPublished: input.isPublished,
				},
			});
			return updated;
		}),
	adminSetClassification: adminProcedure
		.input(contentAdminSetClassificationInputSchema)
		.handler(async ({ context, input }) => {
			const updated = await setContentClassification({
				db: context.db,
				input,
			});
			await logAdminMutation({
				context,
				entityType: "CONTENT",
				action: "SET_CLASSIFICATION",
				entityId: updated.contentId,
				metadata: {
					categoryIds: input.categoryIds,
					genreIds: input.genreIds,
				},
			});
			return updated;
		}),
	adminDelete: adminProcedure
		.input(contentAdminDeleteInputSchema)
		.handler(async ({ context, input }) => {
			const deleted = await deleteContent({
				db: context.db,
				input,
				updatedBy: context.session.user.id,
			});
			await logAdminMutation({
				context,
				entityType: "CONTENT",
				action: "DELETE",
				entityId: deleted.id,
			});
			return deleted;
		}),
	adminSetAvailability: adminProcedure
		.input(contentAdminSetAvailabilityInputSchema)
		.handler(async ({ context, input }) => {
			const updated = await setContentAvailability({
				db: context.db,
				input,
				updatedBy: context.session.user.id,
			});
			await logAdminMutation({
				context,
				entityType: "CONTENT",
				action: "SET_AVAILABILITY",
				entityId: updated.id,
				metadata: {
					isAvailable: input.isAvailable,
				},
			});
			return updated;
		}),
});
