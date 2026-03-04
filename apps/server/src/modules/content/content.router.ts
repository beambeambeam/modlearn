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
	contentAdminByIdInputSchema,
	contentAdminCreateInputSchema,
	contentAdminDeleteInputSchema,
	contentAdminListInputSchema,
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
			tags: ["Content Public"],
			summary: "List Available Public Content",
			description:
				"Public endpoint. Returns only content that is both published and available.",
		})
		.input(contentListInputSchema.optional())
		.output(contentListOutputSchema)
		.handler(({ context, input }) => {
			const parsedInput = contentListInputSchema.parse(input ?? {});
			return listContent({
				db: context.db,
				input: {
					...parsedInput,
					onlyPublished: true,
				},
			});
		}),
	getById: publicProcedure
		.route({
			method: "POST",
			path: "/rpc/content/getById",
			tags: ["Content Public"],
			summary: "Retrieve Available Public Content By ID",
			description:
				"Public endpoint. Returns content by ID only when it is both published and available.",
		})
		.input(contentByIdInputSchema)
		.output(contentDetailOutputSchema)
		.handler(({ context, input }) => {
			return getContentById({
				db: context.db,
				input: {
					...input,
					onlyPublished: true,
				},
			});
		}),
	listPopular: publicProcedure
		.route({
			method: "POST",
			path: "/rpc/content/listPopular",
			tags: ["Content Public"],
			summary: "List Popular Public Content",
			description:
				"Public endpoint. Returns popular content that is currently published and available.",
		})
		.input(contentListPopularInputSchema.optional())
		.output(z.array(contentSchema))
		.handler(({ context, input }) => {
			return listPopularContent({
				db: context.db,
				input: contentListPopularInputSchema.parse(input ?? {}),
			});
		}),
	adminList: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/content/adminList",
			tags: ["Content Admin"],
			summary: "List Admin Content Catalog",
			description:
				"Requires admin or superadmin role. Can return published, unpublished, available, or unavailable content.",
		})
		.input(contentAdminListInputSchema.optional())
		.output(contentListOutputSchema)
		.handler(({ context, input }) => {
			return listContent({
				db: context.db,
				input: contentAdminListInputSchema.parse(input ?? {}),
			});
		}),
	adminGetById: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/content/adminGetById",
			tags: ["Content Admin"],
			summary: "Retrieve Admin Content Details By ID",
			description:
				"Requires admin or superadmin role. Can return unpublished or unavailable content details.",
		})
		.input(contentAdminByIdInputSchema)
		.output(contentDetailOutputSchema)
		.handler(({ context, input }) => {
			return getContentById({
				db: context.db,
				input,
			});
		}),
	adminCreate: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/content/adminCreate",
			tags: ["Content Admin"],
			summary: "Create Content",
			description:
				"Requires admin or superadmin role. Creates a new content item.",
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
			tags: ["Content Admin"],
			summary: "Update Content",
			description:
				"Requires admin or superadmin role. Updates mutable content fields.",
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
			tags: ["Content Admin"],
			summary: "Set Content Publish State",
			description:
				"Requires admin or superadmin role. Sets whether content is published.",
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
			tags: ["Content Admin"],
			summary: "Set Content Category Classification",
			description:
				"Requires admin or superadmin role. Updates category associations for a content item.",
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
			tags: ["Content Admin"],
			summary: "Delete Content",
			description:
				"Requires admin or superadmin role. Deletes a content item and returns deletion metadata.",
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
			tags: ["Content Admin"],
			summary: "Set Content Availability State",
			description:
				"Requires admin or superadmin role. Sets whether content is available for access.",
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
