import type { DbClient } from "@/lib/db/orm";
import type { course, courseLesson, watchProgress } from "@/lib/db/schema";

export interface WatchProgressSaveInput {
	userId: string;
	courseId: string;
	courseLessonId: string;
	lastPosition: number;
	duration: number;
	deviceType?: string | null;
}

export interface WatchProgressMarkCompletedInput {
	userId: string;
	courseId: string;
	courseLessonId: string;
	duration?: number;
	deviceType?: string | null;
}

export interface WatchProgressGetResumeInput {
	userId: string;
	courseLessonId: string;
}

export interface WatchProgressGetCourseResumeInput {
	userId: string;
	courseId: string;
}

export interface WatchProgressGetCourseAutoPlayNextInput {
	userId: string;
	courseId: string;
	courseLessonId: string;
}

export interface WatchProgressContinueWatchingInput {
	userId: string;
	page?: number;
	limit?: number;
}

export interface SaveWatchProgressParams {
	db: DbClient;
	input: WatchProgressSaveInput;
}

export interface MarkWatchProgressCompletedParams {
	db: DbClient;
	input: WatchProgressMarkCompletedInput;
}

export interface GetWatchProgressResumeParams {
	db: DbClient;
	input: WatchProgressGetResumeInput;
}

export interface GetCourseWatchProgressResumeParams {
	db: DbClient;
	input: WatchProgressGetCourseResumeInput;
}

export interface GetCourseAutoPlayNextParams {
	db: DbClient;
	input: WatchProgressGetCourseAutoPlayNextInput;
}

export interface ListContinueWatchingParams {
	db: DbClient;
	input: WatchProgressContinueWatchingInput;
}

export interface ProgressEnvelope {
	progress: typeof watchProgress.$inferSelect;
	progressPercent: number;
}

export interface WatchProgressResumeResult extends ProgressEnvelope {
	resumePosition: number;
}

export type CourseLessonProgressSummary = Pick<
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

export interface CourseWatchProgressResumeResult {
	courseId: string;
	currentLesson: CourseLessonProgressSummary;
	resumePosition: number;
	nextLesson: CourseLessonProgressSummary | null;
	isCourseCompleted: boolean;
	lastWatchedCourseLessonId: string | null;
}

export interface CourseAutoPlayNextResult {
	courseId: string;
	courseLessonId: string;
	nextLesson: CourseLessonProgressSummary | null;
	isCourseCompleted: boolean;
}

export type ContinueWatchingCourseSummary = Pick<
	typeof course.$inferSelect,
	"id" | "title" | "thumbnailImageId"
>;

export interface ContinueWatchingItem extends ProgressEnvelope {
	course: ContinueWatchingCourseSummary;
	lesson: CourseLessonProgressSummary;
}

export interface ContinueWatchingResult {
	items: ContinueWatchingItem[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

export class WatchProgressCourseNotFoundError extends Error {
	constructor() {
		super("Course not found");
		this.name = "WatchProgressCourseNotFoundError";
	}
}

export class WatchProgressCourseLessonNotFoundError extends Error {
	constructor() {
		super("Course lesson not found");
		this.name = "WatchProgressCourseLessonNotFoundError";
	}
}

export class WatchProgressContentNotFoundError extends WatchProgressCourseLessonNotFoundError {
	constructor() {
		super();
		this.name = "WatchProgressContentNotFoundError";
	}
}

export class WatchProgressPlaylistNotFoundError extends WatchProgressCourseNotFoundError {
	constructor() {
		super();
		this.name = "WatchProgressPlaylistNotFoundError";
	}
}

export class WatchProgressValidationError extends Error {
	constructor(message = "Invalid watch progress input") {
		super(message);
		this.name = "WatchProgressValidationError";
	}
}
