import type { DbClient } from "@/lib/db/orm";
import type { content, contentTypeEnum } from "@/lib/db/schema";

export type ContentType = (typeof contentTypeEnum.enumValues)[number];

export type ContentSortBy = "RECENTLY_ADDED" | "RECENTLY_PUBLISHED";

export interface ContentListInput {
	page?: number;
	limit?: number;
	search?: string;
	contentType?: ContentType;
	sortBy?: ContentSortBy;
	onlyPublished?: boolean;
	categoryIds?: string[];
	genreIds?: string[];
}

export interface ContentByIdInput {
	id: string;
	onlyPublished?: boolean;
}

export interface ContentClassificationItem {
	id: string;
	title: string;
	slug: string | null;
	description: string | null;
}

export interface ContentListPopularInput {
	limit?: number;
}

export interface AdminCreateContentInput {
	title: string;
	description?: string | null;
	thumbnailImageId?: string | null;
	duration?: number | null;
	releaseDate?: string | null;
	contentType: ContentType;
	fileId?: string | null;
}

export interface AdminUpdateContentInput {
	id: string;
	patch: Partial<AdminCreateContentInput>;
}

export interface AdminSetPublishStateInput {
	id: string;
	isPublished: boolean;
}

export interface AdminDeleteContentInput {
	id: string;
}

export interface AdminSetAvailabilityInput {
	id: string;
	isAvailable: boolean;
}

export interface AdminSetClassificationInput {
	id: string;
	categoryIds?: string[];
	genreIds?: string[];
}

export interface ListContentParams {
	db: DbClient;
	input: ContentListInput;
}

export interface GetContentByIdParams {
	db: DbClient;
	input: ContentByIdInput;
}

export interface ListPopularContentParams {
	db: DbClient;
	input: ContentListPopularInput;
}

export interface CreateContentParams {
	db: DbClient;
	input: AdminCreateContentInput;
	updatedBy: string;
}

export interface UpdateContentParams {
	db: DbClient;
	input: AdminUpdateContentInput;
	updatedBy: string;
}

export interface SetContentPublishStateParams {
	db: DbClient;
	input: AdminSetPublishStateInput;
	updatedBy: string;
}

export interface SetContentClassificationParams {
	db: DbClient;
	input: AdminSetClassificationInput;
}

export interface DeleteContentParams {
	db: DbClient;
	input: AdminDeleteContentInput;
	updatedBy: string;
}

export interface SetContentAvailabilityParams {
	db: DbClient;
	input: AdminSetAvailabilityInput;
	updatedBy: string;
}

export interface BuildFiltersInput {
	id?: string;
	search?: string;
	contentType?: ContentListInput["contentType"];
	onlyPublished?: boolean;
	categoryIds?: string[];
	genreIds?: string[];
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

export interface ContentClassificationResult {
	contentId: string;
	categories: ContentClassificationItem[];
	genres: ContentClassificationItem[];
}

export interface DeleteContentResult {
	id: string;
	deleted: true;
	deletedAt: Date;
}

type ContentRow = typeof content.$inferSelect;

export type ContentDetailResult = ContentRow & {
	categories: ContentClassificationItem[];
	genres: ContentClassificationItem[];
};

export class ContentNotFoundError extends Error {
	constructor() {
		super("Content not found");
		this.name = "ContentNotFoundError";
	}
}

export class CategoryNotFoundError extends Error {
	constructor() {
		super("Category not found");
		this.name = "CategoryNotFoundError";
	}
}

export class GenreNotFoundError extends Error {
	constructor() {
		super("Genre not found");
		this.name = "GenreNotFoundError";
	}
}

export class InvalidClassificationInputError extends Error {
	constructor(message = "Invalid classification input") {
		super(message);
		this.name = "InvalidClassificationInputError";
	}
}
