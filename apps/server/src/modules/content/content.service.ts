import { and, count, desc, eq, ilike, type SQL, sql } from "drizzle-orm";
import type { DbClient } from "@/lib/db/orm";
import { content } from "@/lib/db/schema";
import type {
	AdminCreateContentInput,
	AdminSetPublishStateInput,
	AdminUpdateContentInput,
	ContentByIdInput,
	ContentListInput,
	ContentListPopularInput,
} from "./content.types";
import { ContentNotFoundError } from "./content.types";

interface ListContentParams {
	db: DbClient;
	input: ContentListInput;
}

interface GetContentByIdParams {
	db: DbClient;
	input: ContentByIdInput;
}

interface ListPopularContentParams {
	db: DbClient;
	input: ContentListPopularInput;
}

interface CreateContentParams {
	db: DbClient;
	input: AdminCreateContentInput;
	updatedBy: string;
}

interface UpdateContentParams {
	db: DbClient;
	input: AdminUpdateContentInput;
	updatedBy: string;
}

interface SetContentPublishStateParams {
	db: DbClient;
	input: AdminSetPublishStateInput;
	updatedBy: string;
}

interface BuildFiltersInput {
	id?: string;
	search?: string;
	contentType?: ContentListInput["contentType"];
	onlyPublished?: boolean;
}

export interface ContentPagination {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
}

export interface ListContentResult {
	items: (typeof content.$inferSelect)[];
	pagination: ContentPagination;
}

function toReleaseDate(
	value: string | null | undefined
): Date | null | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (value === null) {
		return null;
	}
	return new Date(`${value}T00:00:00.000Z`);
}

function normalizeString(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

function buildContentFilters(
	input: BuildFiltersInput
): SQL<unknown> | undefined {
	const conditions: SQL<unknown>[] = [];

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

	if (conditions.length === 0) {
		return undefined;
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
	const filters = buildContentFilters({
		search: input.search,
		contentType: input.contentType,
		onlyPublished: input.onlyPublished ?? true,
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
): Promise<typeof content.$inferSelect> {
	const { db, input } = params;
	const filters = buildContentFilters({
		id: input.id,
		onlyPublished: input.onlyPublished ?? true,
	});

	const row = await db.query.content.findFirst({
		where: filters,
	});

	if (!row) {
		throw new ContentNotFoundError();
	}

	return row;
}

export function listPopularContent(
	params: ListPopularContentParams
): Promise<(typeof content.$inferSelect)[]> {
	const { db, input } = params;
	const limit = input.limit ?? 10;
	const filters = buildContentFilters({
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
		.where(eq(content.id, input.id))
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
		where: eq(content.id, input.id),
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
		.where(eq(content.id, input.id))
		.returning();

	if (!updated) {
		throw new ContentNotFoundError();
	}

	return updated;
}
