import type { DbClient } from "@/lib/db/orm";
import type { course, courseLesson } from "@/lib/db/schema";

export interface LibraryListMyItemsInput {
	page?: number;
	limit?: number;
}

export interface LibraryGetCourseInput {
	courseId: string;
}

export interface LibraryHasAccessInput {
	courseId?: string;
	courseLessonId?: string;
}

export interface ListMyLibraryItemsParams {
	db: DbClient;
	userId: string;
	input: LibraryListMyItemsInput;
}

export interface GetMyCourseParams {
	db: DbClient;
	userId: string;
	input: LibraryGetCourseInput;
}

export interface HasLibraryAccessParams {
	db: DbClient;
	userId: string;
	input: LibraryHasAccessInput;
}

export type LibraryCourseSummary = Pick<
	typeof course.$inferSelect,
	| "id"
	| "creatorId"
	| "title"
	| "description"
	| "thumbnailImageId"
	| "isPublished"
	| "publishedAt"
	| "isAvailable"
	| "isDeleted"
	| "deletedAt"
	| "createdAt"
	| "updatedAt"
>;

export type LibraryCourseLessonSummary = Pick<
	typeof courseLesson.$inferSelect,
	| "id"
	| "courseId"
	| "lessonOrder"
	| "title"
	| "description"
	| "thumbnailImageId"
	| "duration"
	| "releaseDate"
	| "fileId"
	| "addedAt"
	| "createdAt"
	| "updatedAt"
>;

export interface LibraryCourseItem {
	type: "COURSE";
	acquiredAt: Date;
	expiresAt: Date | null;
	orderId: string;
	course: LibraryCourseSummary;
	lessons: LibraryCourseLessonSummary[];
}

export type LibraryItem = LibraryCourseItem;

export interface LibraryListMyItemsResult {
	items: LibraryItem[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

export interface LibraryHasAccessResult {
	hasAccess: boolean;
}

export class LibraryCourseNotFoundError extends Error {
	constructor() {
		super("Course not found");
		this.name = "LibraryCourseNotFoundError";
	}
}

export class LibraryPlaylistNotFoundError extends LibraryCourseNotFoundError {
	constructor() {
		super();
		this.name = "LibraryPlaylistNotFoundError";
	}
}

export class LibraryAccessDeniedError extends Error {
	constructor() {
		super("You do not have access to this course");
		this.name = "LibraryAccessDeniedError";
	}
}
