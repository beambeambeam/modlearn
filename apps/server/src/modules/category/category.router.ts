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
	categoryListInputSchema,
} from "@/modules/category/category.validators";
import { adminProcedure, publicProcedure, router } from "@/orpc";

export const categoryRouter = router({
	list: publicProcedure
		.input(categoryListInputSchema.partial().optional())
		.handler(({ context, input }) => {
			return listCategories({
				db: context.db,
				input: categoryListInputSchema.parse(input ?? {}),
			});
		}),
	getById: publicProcedure
		.input(categoryByIdInputSchema)
		.handler(({ context, input }) => {
			return getCategoryById({
				db: context.db,
				input,
			});
		}),
	adminCreate: adminProcedure
		.input(categoryAdminCreateInputSchema)
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
		.input(categoryAdminUpdateInputSchema)
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
		.input(categoryAdminDeleteInputSchema)
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
