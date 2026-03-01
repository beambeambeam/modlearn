import type { contentTypeEnum } from "@/lib/db/schema";

export type ContentType = (typeof contentTypeEnum.enumValues)[number];

export type ContentSortBy = "RECENTLY_ADDED" | "RECENTLY_PUBLISHED";

export interface ContentListInput {
	page?: number;
	limit?: number;
	search?: string;
	contentType?: ContentType;
	sortBy?: ContentSortBy;
	onlyPublished?: boolean;
}

export interface ContentByIdInput {
	id: string;
	onlyPublished?: boolean;
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

export class ContentNotFoundError extends Error {
	constructor() {
		super("Content not found");
		this.name = "ContentNotFoundError";
	}
}
