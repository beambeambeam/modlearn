import { TRPCError } from "@trpc/server";
import {
	createCategory,
	deleteCategory,
	getCategoryById,
	listCategories,
	updateCategory,
} from "@/modules/category/category.service";
import {
	CategoryNotFoundError,
	CategorySlugConflictError,
} from "@/modules/category/category.types";
import {
	categoryAdminCreateInputSchema,
	categoryAdminDeleteInputSchema,
	categoryAdminUpdateInputSchema,
	categoryByIdInputSchema,
	categoryListInputSchema,
} from "@/modules/category/category.validators";
import { adminProcedure, publicProcedure, router } from "../index";

function mapCategoryError(error: unknown): never {
	if (error instanceof CategoryNotFoundError) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: error.message,
		});
	}

	if (error instanceof CategorySlugConflictError) {
		throw new TRPCError({
			code: "CONFLICT",
			message: error.message,
		});
	}

	throw error;
}

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
				return await createCategory({
					db: ctx.db,
					input,
				});
			} catch (error) {
				mapCategoryError(error);
			}
		}),
	adminUpdate: adminProcedure
		.input(categoryAdminUpdateInputSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				return await updateCategory({
					db: ctx.db,
					input,
				});
			} catch (error) {
				mapCategoryError(error);
			}
		}),
	adminDelete: adminProcedure
		.input(categoryAdminDeleteInputSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				return await deleteCategory({
					db: ctx.db,
					input,
				});
			} catch (error) {
				mapCategoryError(error);
			}
		}),
});
