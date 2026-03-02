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
			tags: ["Category"],
			summary: "List categories",
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
			tags: ["Category"],
			summary: "Get category by ID",
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
			tags: ["Category"],
			summary: "Create category",
			description: "Requires admin or superadmin role.",
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
			tags: ["Category"],
			summary: "Update category",
			description: "Requires admin or superadmin role.",
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
			tags: ["Category"],
			summary: "Delete category",
			description: "Requires admin or superadmin role.",
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
