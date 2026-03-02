import { and, asc, count, eq, ilike, ne } from "drizzle-orm";
import type { DbClient } from "@/lib/db/orm";
import { category } from "@/lib/db/schema";
import { toError } from "@/orpc/error-mapper";
import type {
	CategoryListResult,
	CreateCategoryParams,
	DeleteCategoryParams,
	GetCategoryByIdParams,
	ListCategoriesParams,
	UpdateCategoryParams,
} from "./category.types";
import {
	CategoryNotFoundError,
	CategorySlugConflictError,
} from "./category.types";
import { isUniqueViolation, normalizeSlug } from "./category.utils";

async function assertSlugUnique(
	db: DbClient,
	slug: string,
	excludeId?: string
): Promise<void> {
	const found = await db.query.category.findFirst({
		where: excludeId
			? and(eq(category.slug, slug), ne(category.id, excludeId))
			: eq(category.slug, slug),
		columns: {
			id: true,
		},
	});

	if (found) {
		throw new CategorySlugConflictError();
	}
}

export async function listCategories(
	params: ListCategoriesParams
): Promise<CategoryListResult> {
	const { db, input } = params;
	const page = input.page ?? 1;
	const limit = input.limit ?? 20;
	const offset = (page - 1) * limit;

	const where = input.search
		? ilike(category.title, `%${input.search.trim()}%`)
		: undefined;

	const countRows = await db
		.select({
			total: count(),
		})
		.from(category)
		.where(where);
	const total = Number(countRows[0]?.total ?? 0);

	const items = await db
		.select()
		.from(category)
		.where(where)
		.orderBy(asc(category.title), asc(category.id))
		.limit(limit)
		.offset(offset);

	return {
		items,
		pagination: {
			page,
			limit,
			total,
			totalPages: total === 0 ? 0 : Math.ceil(total / limit),
		},
	};
}

export async function getCategoryById(
	params: GetCategoryByIdParams
): Promise<typeof category.$inferSelect> {
	const { db, input } = params;
	const row = await db.query.category.findFirst({
		where: eq(category.id, input.id),
	});
	if (!row) {
		throw new CategoryNotFoundError();
	}
	return row;
}

export async function createCategory(
	params: CreateCategoryParams
): Promise<typeof category.$inferSelect> {
	const { db, input } = params;
	const slug = normalizeSlug(input.slug);
	await assertSlugUnique(db, slug);

	try {
		const [created] = await db
			.insert(category)
			.values({
				title: input.title,
				description: input.description ?? null,
				slug,
			})
			.returning();
		if (!created) {
			throw new Error("Failed to create category");
		}
		return created;
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw new CategorySlugConflictError();
		}
		throw toError(error);
	}
}

export async function updateCategory(
	params: UpdateCategoryParams
): Promise<typeof category.$inferSelect> {
	const { db, input } = params;
	const existing = await db.query.category.findFirst({
		where: eq(category.id, input.id),
		columns: {
			id: true,
		},
	});
	if (!existing) {
		throw new CategoryNotFoundError();
	}

	const values: Partial<typeof category.$inferInsert> = {};
	if (input.patch.title !== undefined) {
		values.title = input.patch.title;
	}
	if (input.patch.description !== undefined) {
		values.description = input.patch.description;
	}
	if (input.patch.slug !== undefined) {
		const slug = normalizeSlug(input.patch.slug);
		await assertSlugUnique(db, slug, input.id);
		values.slug = slug;
	}

	try {
		const [updated] = await db
			.update(category)
			.set(values)
			.where(eq(category.id, input.id))
			.returning();
		if (!updated) {
			throw new CategoryNotFoundError();
		}
		return updated;
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw new CategorySlugConflictError();
		}
		throw toError(error);
	}
}

export async function deleteCategory(
	params: DeleteCategoryParams
): Promise<{ id: string; deleted: true }> {
	const { db, input } = params;
	const [deleted] = await db
		.delete(category)
		.where(eq(category.id, input.id))
		.returning();

	if (!deleted) {
		throw new CategoryNotFoundError();
	}

	return {
		id: deleted.id,
		deleted: true,
	};
}
