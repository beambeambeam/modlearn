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
import { mapCategoryError } from "@/orpc/routers/router.utils";

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
		.handler(async ({ context, input }) => {
			try {
				return await getCategoryById({
					db: context.db,
					input,
				});
			} catch (error) {
				mapCategoryError(error);
			}
		}),
	adminCreate: adminProcedure
		.input(categoryAdminCreateInputSchema)
		.handler(async ({ context, input }) => {
			try {
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
			} catch (error) {
				mapCategoryError(error);
			}
		}),
	adminUpdate: adminProcedure
		.input(categoryAdminUpdateInputSchema)
		.handler(async ({ context, input }) => {
			try {
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
			} catch (error) {
				mapCategoryError(error);
			}
		}),
	adminDelete: adminProcedure
		.input(categoryAdminDeleteInputSchema)
		.handler(async ({ context, input }) => {
			try {
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
			} catch (error) {
				mapCategoryError(error);
			}
		}),
});
