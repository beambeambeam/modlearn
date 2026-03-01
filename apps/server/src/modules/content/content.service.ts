import {
	and,
	asc,
	count,
	desc,
	eq,
	exists,
	ilike,
	inArray,
	type SQL,
	sql,
} from "drizzle-orm";
import type { DbClient } from "@/lib/db/orm";
import {
	category,
	content,
	contentCategory,
	contentGenre,
	genre,
} from "@/lib/db/schema";
import type {
	BuildFiltersInput,
	ContentClassificationResult,
	ContentDetailResult,
	CreateContentParams,
	DeleteContentParams,
	DeleteContentResult,
	GetContentByIdParams,
	ListContentParams,
	ListContentResult,
	ListPopularContentParams,
	SetContentAvailabilityParams,
	SetContentClassificationParams,
	SetContentPublishStateParams,
	UpdateContentParams,
} from "./content.types";
import {
	CategoryNotFoundError,
	ContentNotFoundError,
	GenreNotFoundError,
	InvalidClassificationInputError,
} from "./content.types";
import { hasDuplicates, normalizeString, toReleaseDate } from "./content.utils";

async function ensureContentExists(
	db: DbClient,
	contentId: string
): Promise<void> {
	const row = await db.query.content.findFirst({
		where: and(eq(content.id, contentId), eq(content.isDeleted, false)),
		columns: { id: true },
	});

	if (!row) {
		throw new ContentNotFoundError();
	}
}

async function ensureCategoriesExist(
	db: DbClient,
	ids: string[]
): Promise<void> {
	if (ids.length === 0) {
		return;
	}

	const rows = await db
		.select({ id: category.id })
		.from(category)
		.where(inArray(category.id, ids));
	if (rows.length !== ids.length) {
		throw new CategoryNotFoundError();
	}
}

async function ensureGenresExist(db: DbClient, ids: string[]): Promise<void> {
	if (ids.length === 0) {
		return;
	}

	const rows = await db
		.select({ id: genre.id })
		.from(genre)
		.where(inArray(genre.id, ids));
	if (rows.length !== ids.length) {
		throw new GenreNotFoundError();
	}
}

function buildContentFilters(
	db: DbClient,
	input: BuildFiltersInput
): SQL<unknown> | undefined {
	const conditions: SQL<unknown>[] = [eq(content.isDeleted, false)];

	if (input.id) {
		conditions.push(eq(content.id, input.id));
	}

	if (input.onlyPublished ?? true) {
		conditions.push(eq(content.isPublished, true));
		conditions.push(eq(content.isAvailable, true));
	}

	const search = normalizeString(input.search);
	if (search) {
		conditions.push(ilike(content.title, `%${search}%`));
	}

	if (input.contentType) {
		conditions.push(eq(content.contentType, input.contentType));
	}

	if (input.categoryIds && input.categoryIds.length > 0) {
		conditions.push(
			exists(
				db
					.select({ id: contentCategory.id })
					.from(contentCategory)
					.where(
						and(
							eq(contentCategory.contentId, content.id),
							inArray(contentCategory.categoryId, input.categoryIds)
						)
					)
			)
		);
	}

	if (input.genreIds && input.genreIds.length > 0) {
		conditions.push(
			exists(
				db
					.select({ id: contentGenre.id })
					.from(contentGenre)
					.where(
						and(
							eq(contentGenre.contentId, content.id),
							inArray(contentGenre.genreId, input.genreIds)
						)
					)
			)
		);
	}

	return and(...conditions);
}

export async function listContent(
	params: ListContentParams
): Promise<ListContentResult> {
	const { db, input } = params;
	const page = input.page ?? 1;
	const limit = input.limit ?? 20;
	const offset = (page - 1) * limit;
	const filters = buildContentFilters(db, {
		search: input.search,
		contentType: input.contentType,
		onlyPublished: input.onlyPublished ?? true,
		categoryIds: input.categoryIds,
		genreIds: input.genreIds,
	});

	const countRows = await db
		.select({
			total: count(),
		})
		.from(content)
		.where(filters);
	const total = Number(countRows[0]?.total ?? 0);

	const sortBy = input.sortBy ?? "RECENTLY_ADDED";
	const orderByClause =
		sortBy === "RECENTLY_PUBLISHED"
			? [sql`${content.publishedAt} DESC NULLS LAST`, desc(content.createdAt)]
			: [desc(content.createdAt), desc(content.id)];

	const items = await db
		.select()
		.from(content)
		.where(filters)
		.orderBy(...orderByClause)
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

export async function getContentById(
	params: GetContentByIdParams
): Promise<ContentDetailResult> {
	const { db, input } = params;
	const filters = buildContentFilters(db, {
		id: input.id,
		onlyPublished: input.onlyPublished ?? true,
	});

	const row = await db.query.content.findFirst({
		where: filters,
	});

	if (!row) {
		throw new ContentNotFoundError();
	}

	const classification = await getContentClassification({
		db,
		contentId: row.id,
	});

	return {
		...row,
		categories: classification.categories,
		genres: classification.genres,
	};
}

export function listPopularContent(
	params: ListPopularContentParams
): Promise<(typeof content.$inferSelect)[]> {
	const { db, input } = params;
	const limit = input.limit ?? 10;
	const filters = buildContentFilters(db, {
		onlyPublished: true,
	});

	return db
		.select()
		.from(content)
		.where(filters)
		.orderBy(desc(content.viewCount), desc(content.createdAt), desc(content.id))
		.limit(limit);
}

export async function createContent(
	params: CreateContentParams
): Promise<typeof content.$inferSelect> {
	const { db, input, updatedBy } = params;
	const [created] = await db
		.insert(content)
		.values({
			title: input.title,
			description: input.description ?? null,
			thumbnailImageId: input.thumbnailImageId ?? null,
			duration: input.duration ?? null,
			releaseDate: toReleaseDate(input.releaseDate),
			contentType: input.contentType,
			fileId: input.fileId ?? null,
			updatedBy,
			isPublished: false,
			publishedAt: null,
		})
		.returning();

	if (!created) {
		throw new Error("Failed to create content");
	}

	return created;
}

export async function updateContent(
	params: UpdateContentParams
): Promise<typeof content.$inferSelect> {
	const { db, input, updatedBy } = params;

	const values: Partial<typeof content.$inferInsert> = {
		updatedBy,
	};

	if (input.patch.title !== undefined) {
		values.title = input.patch.title;
	}
	if (input.patch.description !== undefined) {
		values.description = input.patch.description;
	}
	if (input.patch.thumbnailImageId !== undefined) {
		values.thumbnailImageId = input.patch.thumbnailImageId;
	}
	if (input.patch.duration !== undefined) {
		values.duration = input.patch.duration;
	}
	if (input.patch.releaseDate !== undefined) {
		values.releaseDate = toReleaseDate(input.patch.releaseDate);
	}
	if (input.patch.contentType !== undefined) {
		values.contentType = input.patch.contentType;
	}
	if (input.patch.fileId !== undefined) {
		values.fileId = input.patch.fileId;
	}

	const [updated] = await db
		.update(content)
		.set(values)
		.where(and(eq(content.id, input.id), eq(content.isDeleted, false)))
		.returning();

	if (!updated) {
		throw new ContentNotFoundError();
	}

	return updated;
}

export async function setContentPublishState(
	params: SetContentPublishStateParams
): Promise<typeof content.$inferSelect> {
	const { db, input, updatedBy } = params;
	const existing = await db.query.content.findFirst({
		where: and(eq(content.id, input.id), eq(content.isDeleted, false)),
	});

	if (!existing) {
		throw new ContentNotFoundError();
	}

	const publishedAt = input.isPublished
		? (existing.publishedAt ?? new Date())
		: null;

	const [updated] = await db
		.update(content)
		.set({
			isPublished: input.isPublished,
			publishedAt,
			updatedBy,
		})
		.where(and(eq(content.id, input.id), eq(content.isDeleted, false)))
		.returning();

	if (!updated) {
		throw new ContentNotFoundError();
	}

	return updated;
}

export async function getContentClassification(params: {
	db: DbClient;
	contentId: string;
}): Promise<ContentClassificationResult> {
	const { db, contentId } = params;

	const categoryRows = await db
		.select({
			id: category.id,
			title: category.title,
			slug: category.slug,
			description: category.description,
		})
		.from(contentCategory)
		.innerJoin(category, eq(contentCategory.categoryId, category.id))
		.where(eq(contentCategory.contentId, contentId))
		.orderBy(asc(category.title), asc(category.id));

	const genreRows = await db
		.select({
			id: genre.id,
			title: genre.title,
			slug: genre.slug,
			description: genre.description,
		})
		.from(contentGenre)
		.innerJoin(genre, eq(contentGenre.genreId, genre.id))
		.where(eq(contentGenre.contentId, contentId))
		.orderBy(asc(genre.title), asc(genre.id));

	return {
		contentId,
		categories: categoryRows,
		genres: genreRows,
	};
}

export function setContentClassification(
	params: SetContentClassificationParams
): Promise<ContentClassificationResult> {
	const { db, input } = params;

	if (input.categoryIds === undefined && input.genreIds === undefined) {
		throw new InvalidClassificationInputError(
			"At least one of categoryIds or genreIds must be provided"
		);
	}
	if (input.categoryIds && hasDuplicates(input.categoryIds)) {
		throw new InvalidClassificationInputError(
			"categoryIds contains duplicates"
		);
	}
	if (input.genreIds && hasDuplicates(input.genreIds)) {
		throw new InvalidClassificationInputError("genreIds contains duplicates");
	}

	return db.transaction(async (tx) => {
		await ensureContentExists(tx, input.id);

		const normalizedCategoryIds = input.categoryIds
			? [...new Set(input.categoryIds)]
			: undefined;
		const normalizedGenreIds = input.genreIds
			? [...new Set(input.genreIds)]
			: undefined;

		if (normalizedCategoryIds !== undefined) {
			await ensureCategoriesExist(tx, normalizedCategoryIds);
		}
		if (normalizedGenreIds !== undefined) {
			await ensureGenresExist(tx, normalizedGenreIds);
		}

		if (normalizedCategoryIds !== undefined) {
			await tx
				.delete(contentCategory)
				.where(eq(contentCategory.contentId, input.id));

			if (normalizedCategoryIds.length > 0) {
				await tx.insert(contentCategory).values(
					normalizedCategoryIds.map((categoryId) => ({
						contentId: input.id,
						categoryId,
					}))
				);
			}
		}

		if (normalizedGenreIds !== undefined) {
			await tx.delete(contentGenre).where(eq(contentGenre.contentId, input.id));

			if (normalizedGenreIds.length > 0) {
				await tx.insert(contentGenre).values(
					normalizedGenreIds.map((genreId) => ({
						contentId: input.id,
						genreId,
					}))
				);
			}
		}

		return getContentClassification({
			db: tx,
			contentId: input.id,
		});
	});
}

export async function deleteContent(
	params: DeleteContentParams
): Promise<DeleteContentResult> {
	const { db, input, updatedBy } = params;
	const deletedAt = new Date();

	const [updated] = await db
		.update(content)
		.set({
			isDeleted: true,
			deletedAt,
			updatedBy,
		})
		.where(and(eq(content.id, input.id), eq(content.isDeleted, false)))
		.returning();

	if (!updated?.deletedAt) {
		throw new ContentNotFoundError();
	}

	return {
		id: updated.id,
		deleted: true,
		deletedAt: updated.deletedAt,
	};
}

export async function setContentAvailability(
	params: SetContentAvailabilityParams
): Promise<typeof content.$inferSelect> {
	const { db, input, updatedBy } = params;

	const [updated] = await db
		.update(content)
		.set({
			isAvailable: input.isAvailable,
			updatedBy,
		})
		.where(and(eq(content.id, input.id), eq(content.isDeleted, false)))
		.returning();

	if (!updated) {
		throw new ContentNotFoundError();
	}

	return updated;
}
