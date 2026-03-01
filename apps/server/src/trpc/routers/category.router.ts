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
import { adminProcedure, publicProcedure, router } from "../index";
import { logAdminMutation } from "./_audit";
import { mapCategoryError } from "./router.utils";

export const categoryRouter = router({
	list: publicProcedure
		.input(categoryListInputSchema.partial().optional())
		.query(({ ctx, input }) => {
			return listCategories({
				db: ctx.db,
				input: categoryListInputSchema.parse(input ?? {}),
			});
		}),
	getById: publicProcedure
		.input(categoryByIdInputSchema)
		.query(async ({ ctx, input }) => {
			try {
				return await getCategoryById({
					db: ctx.db,
					input,
				});
			} catch (error) {
				mapCategoryError(error);
			}
		}),
	adminCreate: adminProcedure
		.input(categoryAdminCreateInputSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				const created = await createCategory({
					db: ctx.db,
					input,
				});
				await logAdminMutation({
					ctx,
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
		.mutation(async ({ ctx, input }) => {
			try {
				const updated = await updateCategory({
					db: ctx.db,
					input,
				});
				await logAdminMutation({
					ctx,
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
		.mutation(async ({ ctx, input }) => {
			try {
				const deleted = await deleteCategory({
					db: ctx.db,
					input,
				});
				await logAdminMutation({
					ctx,
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
