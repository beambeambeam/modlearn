import { z } from "zod";
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
	contentClassificationOutputSchema,
	contentDeleteOutputSchema,
	contentDetailOutputSchema,
	contentListInputSchema,
	contentListOutputSchema,
	contentListPopularInputSchema,
	contentSchema,
} from "@/modules/content/content.validators";
import { adminProcedure, publicProcedure, router } from "@/orpc";

export const contentRouter = router({
	list: publicProcedure
		.route({
			method: "POST",
			path: "/rpc/content/list",
			tags: ["Content"],
			summary: "List content",
		})
		.input(contentListInputSchema.optional())
		.output(contentListOutputSchema)
		.handler(({ context, input }) => {
			return listContent({
				db: context.db,
				input: contentListInputSchema.parse(input ?? {}),
			});
		}),
	getById: publicProcedure
		.route({
			method: "POST",
			path: "/rpc/content/getById",
			tags: ["Content"],
			summary: "Get content by ID",
		})
		.input(contentByIdInputSchema)
		.output(contentDetailOutputSchema)
		.handler(({ context, input }) => {
			return getContentById({
				db: context.db,
				input,
			});
		}),
	listPopular: publicProcedure
		.route({
			method: "POST",
			path: "/rpc/content/listPopular",
			tags: ["Content"],
			summary: "List popular content",
		})
		.input(contentListPopularInputSchema.optional())
		.output(z.array(contentSchema))
		.handler(({ context, input }) => {
			return listPopularContent({
				db: context.db,
				input: contentListPopularInputSchema.parse(input ?? {}),
			});
		}),
	adminCreate: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/content/adminCreate",
			tags: ["Content"],
			summary: "Create content",
			description: "Requires admin or superadmin role.",
		})
		.input(contentAdminCreateInputSchema)
		.output(contentSchema)
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
		.route({
			method: "POST",
			path: "/rpc/content/adminUpdate",
			tags: ["Content"],
			summary: "Update content",
			description: "Requires admin or superadmin role.",
		})
		.input(contentAdminUpdateInputSchema)
		.output(contentSchema)
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
		.route({
			method: "POST",
			path: "/rpc/content/adminSetPublishState",
			tags: ["Content"],
			summary: "Set publish state",
			description: "Requires admin or superadmin role.",
		})
		.input(contentAdminSetPublishStateInputSchema)
		.output(contentSchema)
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
		.route({
			method: "POST",
			path: "/rpc/content/adminSetClassification",
			tags: ["Content"],
			summary: "Set classification",
			description: "Requires admin or superadmin role.",
		})
		.input(contentAdminSetClassificationInputSchema)
		.output(contentClassificationOutputSchema)
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
				},
			});
			return updated;
		}),
	adminDelete: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/content/adminDelete",
			tags: ["Content"],
			summary: "Delete content",
			description: "Requires admin or superadmin role.",
		})
		.input(contentAdminDeleteInputSchema)
		.output(contentDeleteOutputSchema)
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
		.route({
			method: "POST",
			path: "/rpc/content/adminSetAvailability",
			tags: ["Content"],
			summary: "Set availability",
			description: "Requires admin or superadmin role.",
		})
		.input(contentAdminSetAvailabilityInputSchema)
		.output(contentSchema)
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
