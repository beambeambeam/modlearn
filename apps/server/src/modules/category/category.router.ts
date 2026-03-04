import { logAdminMutation } from "@/modules/admin-audit/admin-audit.service";
import {
	createCategory,
	deleteCategory,
	getCategoryById,
	listCategories,
	updateCategory,
} from "@/modules/category/category.service";
import {
	categoryAdminCreateInputSchema,
	categoryAdminDeleteInputSchema,
	categoryAdminUpdateInputSchema,
	categoryByIdInputSchema,
	categoryDeleteOutputSchema,
	categoryListInputSchema,
	categoryListOutputSchema,
	categorySchema,
} from "@/modules/category/category.validators";
import { adminProcedure, publicProcedure, router } from "@/orpc";

export const categoryRouter = router({
	list: publicProcedure
		.route({
			method: "POST",
			path: "/rpc/category/list",
			tags: ["Category Public"],
			summary: "List Public Categories",
			description:
				"Public endpoint. Returns categories available for public browsing.",
		})
		.input(categoryListInputSchema.partial().optional())
		.output(categoryListOutputSchema)
		.handler(({ context, input }) => {
			return listCategories({
				db: context.db,
				input: categoryListInputSchema.parse(input ?? {}),
			});
		}),
	getById: publicProcedure
		.route({
			method: "POST",
			path: "/rpc/category/getById",
			tags: ["Category Public"],
			summary: "Retrieve Public Category By ID",
			description:
				"Public endpoint. Returns a category by ID when available for public browsing.",
		})
		.input(categoryByIdInputSchema)
		.output(categorySchema)
		.handler(({ context, input }) => {
			return getCategoryById({
				db: context.db,
				input,
			});
		}),
	adminCreate: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/category/adminCreate",
			tags: ["Category Admin"],
			summary: "Create Category",
			description:
				"Requires admin or superadmin role. Creates a new category record.",
		})
		.input(categoryAdminCreateInputSchema)
		.output(categorySchema)
		.handler(async ({ context, input }) => {
			const created = await createCategory({
				db: context.db,
				input,
			});
			await logAdminMutation({
				context,
				entityType: "CATEGORY",
				action: "CREATE",
				entityId: created.id,
			});
			return created;
		}),
	adminUpdate: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/category/adminUpdate",
			tags: ["Category Admin"],
			summary: "Update Category",
			description:
				"Requires admin or superadmin role. Updates mutable category fields.",
		})
		.input(categoryAdminUpdateInputSchema)
		.output(categorySchema)
		.handler(async ({ context, input }) => {
			const updated = await updateCategory({
				db: context.db,
				input,
			});
			await logAdminMutation({
				context,
				entityType: "CATEGORY",
				action: "UPDATE",
				entityId: updated.id,
				metadata: {
					patchKeys: Object.keys(input.patch),
				},
			});
			return updated;
		}),
	adminDelete: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/category/adminDelete",
			tags: ["Category Admin"],
			summary: "Delete Category",
			description:
				"Requires admin or superadmin role. Deletes a category and returns deletion metadata.",
		})
		.input(categoryAdminDeleteInputSchema)
		.output(categoryDeleteOutputSchema)
		.handler(async ({ context, input }) => {
			const deleted = await deleteCategory({
				db: context.db,
				input,
			});
			await logAdminMutation({
				context,
				entityType: "CATEGORY",
				action: "DELETE",
				entityId: deleted.id,
			});
			return deleted;
		}),
});
