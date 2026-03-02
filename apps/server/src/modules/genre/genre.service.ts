import { and, asc, count, eq, ilike, ne } from "drizzle-orm";
import type { DbClient } from "@/lib/db/orm";
import { genre } from "@/lib/db/schema";
import { toError } from "@/orpc/error-mapper";
import type {
	CreateGenreParams,
	DeleteGenreParams,
	GenreListResult,
	GetGenreByIdParams,
	ListGenresParams,
	UpdateGenreParams,
} from "./genre.types";
import { GenreNotFoundError, GenreSlugConflictError } from "./genre.types";
import { isUniqueViolation, normalizeSlug } from "./genre.utils";

async function assertSlugUnique(
	db: DbClient,
	slug: string,
	excludeId?: string
): Promise<void> {
	const found = await db.query.genre.findFirst({
		where: excludeId
			? and(eq(genre.slug, slug), ne(genre.id, excludeId))
			: eq(genre.slug, slug),
		columns: {
			id: true,
		},
	});

	if (found) {
		throw new GenreSlugConflictError();
	}
}

export async function listGenres(
	params: ListGenresParams
): Promise<GenreListResult> {
	const { db, input } = params;
	const page = input.page ?? 1;
	const limit = input.limit ?? 20;
	const offset = (page - 1) * limit;

	const where = input.search
		? ilike(genre.title, `%${input.search.trim()}%`)
		: undefined;

	const countRows = await db
		.select({
			total: count(),
		})
		.from(genre)
		.where(where);
	const total = Number(countRows[0]?.total ?? 0);

	const items = await db
		.select()
		.from(genre)
		.where(where)
		.orderBy(asc(genre.title), asc(genre.id))
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

export async function getGenreById(
	params: GetGenreByIdParams
): Promise<typeof genre.$inferSelect> {
	const { db, input } = params;
	const row = await db.query.genre.findFirst({
		where: eq(genre.id, input.id),
	});
	if (!row) {
		throw new GenreNotFoundError();
	}
	return row;
}

export async function createGenre(
	params: CreateGenreParams
): Promise<typeof genre.$inferSelect> {
	const { db, input } = params;
	const slug = normalizeSlug(input.slug);
	await assertSlugUnique(db, slug);

	try {
		const [created] = await db
			.insert(genre)
			.values({
				title: input.title,
				description: input.description ?? null,
				slug,
			})
			.returning();
		if (!created) {
			throw new Error("Failed to create genre");
		}
		return created;
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw new GenreSlugConflictError();
		}
		throw toError(error);
	}
}

export async function updateGenre(
	params: UpdateGenreParams
): Promise<typeof genre.$inferSelect> {
	const { db, input } = params;
	const existing = await db.query.genre.findFirst({
		where: eq(genre.id, input.id),
		columns: {
			id: true,
		},
	});
	if (!existing) {
		throw new GenreNotFoundError();
	}

	const values: Partial<typeof genre.$inferInsert> = {};
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
			.update(genre)
			.set(values)
			.where(eq(genre.id, input.id))
			.returning();
		if (!updated) {
			throw new GenreNotFoundError();
		}
		return updated;
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw new GenreSlugConflictError();
		}
		throw toError(error);
	}
}

export async function deleteGenre(
	params: DeleteGenreParams
): Promise<{ id: string; deleted: true }> {
	const { db, input } = params;
	const [deleted] = await db
		.delete(genre)
		.where(eq(genre.id, input.id))
		.returning();

	if (!deleted) {
		throw new GenreNotFoundError();
	}

	return {
		id: deleted.id,
		deleted: true,
	};
}
