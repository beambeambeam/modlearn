import type { DbClient } from "@/lib/db/orm";
import type {
	category,
	course,
	courseLesson,
} from "@/lib/db/schema";

export type CourseSortBy = "RECENTLY_ADDED" | "RECENTLY_PUBLISHED";

export interface CourseListInput {
	page?: number;
	limit?: number;
	search?: string;
	sortBy?: CourseSortBy;
	categoryIds?: string[];
}

export interface CourseByIdInput {
	id: string;
}

export interface CourseAdminListInput extends CourseListInput {
	onlyPublished?: boolean;
}

export interface CourseAdminByIdInput extends CourseByIdInput {
	onlyPublished?: boolean;
}

export interface CourseListPopularInput {
	limit?: number;
}

export interface CourseClassificationItem
	extends Pick<
		typeof category.$inferSelect,
		"id" | "title" | "slug" | "description"
	> {}

export interface AdminCreateCourseInput {
	title: string;
	description?: string | null;
	thumbnailImageId?: string | null;
}

export interface AdminUpdateCourseInput {
	id: string;
	patch: Partial<AdminCreateCourseInput>;
}

export interface AdminSetPublishStateInput {
	id: string;
	isPublished: boolean;
}

export interface AdminDeleteCourseInput {
	id: string;
}

export interface AdminSetAvailabilityInput {
	id: string;
	isAvailable: boolean;
}

export interface AdminSetClassificationInput {
	id: string;
	categoryIds: string[];
}

export interface CourseLessonListInput {
	courseId: string;
}

export interface AdminAddLessonInput {
	courseId: string;
	title: string;
	description?: string | null;
	thumbnailImageId?: string | null;
	duration?: number | null;
	releaseDate?: string | null;
	fileId?: string | null;
	lessonOrder?: number;
}

export interface AdminUpdateLessonInput {
	id: string;
	patch: {
		title?: string;
		description?: string | null;
		thumbnailImageId?: string | null;
		duration?: number | null;
		releaseDate?: string | null;
		fileId?: string | null;
		lessonOrder?: number;
	};
}

export interface AdminRemoveLessonInput {
	id: string;
}

export interface AdminReorderLessonsInput {
	courseId: string;
	lessonIds: string[];
}

export interface ListCoursesParams {
	db: DbClient;
	input: CourseAdminListInput;
}

export interface GetCourseByIdParams {
	db: DbClient;
	input: CourseAdminByIdInput;
}

export interface ListPopularCoursesParams {
	db: DbClient;
	input: CourseListPopularInput;
}

export interface CreateCourseParams {
	db: DbClient;
	input: AdminCreateCourseInput;
	creatorId: string;
}

export interface UpdateCourseParams {
	db: DbClient;
	input: AdminUpdateCourseInput;
}

export interface SetCoursePublishStateParams {
	db: DbClient;
	input: AdminSetPublishStateInput;
}

export interface SetCourseClassificationParams {
	db: DbClient;
	input: AdminSetClassificationInput;
}

export interface DeleteCourseParams {
	db: DbClient;
	input: AdminDeleteCourseInput;
}

export interface SetCourseAvailabilityParams {
	db: DbClient;
	input: AdminSetAvailabilityInput;
}

export interface ListCourseLessonsParams {
	db: DbClient;
	input: CourseLessonListInput;
	onlyPublished?: boolean;
}

export interface AddLessonToCourseParams {
	db: DbClient;
	input: AdminAddLessonInput;
}

export interface UpdateCourseLessonParams {
	db: DbClient;
	input: AdminUpdateLessonInput;
}

export interface RemoveLessonFromCourseParams {
	db: DbClient;
	input: AdminRemoveLessonInput;
}

export interface ReorderCourseLessonsParams {
	db: DbClient;
	input: AdminReorderLessonsInput;
}

export interface ActivePricing {
	price: string;
	currency: string;
}

export interface CoursePagination {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
}

export type CourseRow = typeof course.$inferSelect;
export type CourseLessonRow = typeof courseLesson.$inferSelect;

export type CourseWithActivePricing = CourseRow & {
	activePricing: ActivePricing | null;
};

export type CourseLessonView = CourseLessonRow;

export interface ListCoursesResult {
	items: CourseWithActivePricing[];
	pagination: CoursePagination;
}

export interface CourseClassificationResult {
	courseId: string;
	categories: CourseClassificationItem[];
}

export interface DeleteCourseResult {
	id: string;
	deleted: true;
	deletedAt: Date;
}

export interface CourseDetailResult extends CourseWithActivePricing {
	categories: CourseClassificationItem[];
	lessons: CourseLessonView[];
}

export interface LessonDeleteResult {
	id: string;
	courseId: string;
	deleted: true;
}

export class CourseNotFoundError extends Error {
	constructor() {
		super("Course not found");
		this.name = "CourseNotFoundError";
	}
}

export class CourseLessonNotFoundError extends Error {
	constructor() {
		super("Course lesson not found");
		this.name = "CourseLessonNotFoundError";
	}
}

export class CategoryNotFoundError extends Error {
	constructor() {
		super("Category not found");
		this.name = "CategoryNotFoundError";
	}
}

export class InvalidClassificationInputError extends Error {
	constructor(message = "Invalid classification input") {
		super(message);
		this.name = "InvalidClassificationInputError";
	}
}

export class CourseReorderValidationError extends Error {
	constructor(message = "Invalid reorder payload for course lessons") {
		super(message);
		this.name = "CourseReorderValidationError";
	}
}
