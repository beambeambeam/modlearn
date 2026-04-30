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
		.handler(({ context, input }) => {
			return createCategory({
				db: context.db,
				input,
			});
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
		.handler(({ context, input }) => {
			return updateCategory({
				db: context.db,
				input,
			});
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
		.handler(({ context, input }) => {
			return deleteCategory({
				db: context.db,
				input,
			});
		}),
});
