import type { DbClient } from "@/lib/db/orm";
import type { category } from "@/lib/db/schema";

export interface CategoryListInput {
	search?: string;
	page?: number;
	limit?: number;
}

export interface CategoryByIdInput {
	id: string;
}

export interface CategoryAdminCreateInput {
	title: string;
	description?: string | null;
	slug: string;
}

export interface CategoryAdminUpdateInput {
	id: string;
	patch: Partial<CategoryAdminCreateInput>;
}

export interface CategoryAdminDeleteInput {
	id: string;
}

export interface CategoryPagination {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
}

export interface CategoryListResult {
	items: (typeof category.$inferSelect)[];
	pagination: CategoryPagination;
}

export interface ListCategoriesParams {
	db: DbClient;
	input: CategoryListInput;
}

export interface GetCategoryByIdParams {
	db: DbClient;
	input: CategoryByIdInput;
}

export interface CreateCategoryParams {
	db: DbClient;
	input: CategoryAdminCreateInput;
}

export interface UpdateCategoryParams {
	db: DbClient;
	input: CategoryAdminUpdateInput;
}

export interface DeleteCategoryParams {
	db: DbClient;
	input: CategoryAdminDeleteInput;
}

export class CategoryNotFoundError extends Error {
	constructor() {
		super("Category not found");
		this.name = "CategoryNotFoundError";
	}
}

export class CategorySlugConflictError extends Error {
	constructor() {
		super("Category slug already exists");
		this.name = "CategorySlugConflictError";
	}
}
