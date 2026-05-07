import { and, asc, count, desc, eq } from "drizzle-orm";
import type { DbClient } from "@/lib/db/orm";
import { course, courseLesson, watchProgress } from "@/lib/db/schema";
import type {
	ContinueWatchingItem,
	ContinueWatchingResult,
	CourseAutoPlayNextResult,
	CourseLessonProgressSummary,
	CourseWatchProgressResumeResult,
	GetCourseAutoPlayNextParams,
	GetCourseWatchProgressResumeParams,
	GetWatchProgressResumeParams,
	ListContinueWatchingParams,
	MarkWatchProgressCompletedParams,
	ProgressEnvelope,
	SaveWatchProgressParams,
	WatchProgressResumeResult,
} from "./watch-progress.types";
import {
	WatchProgressCourseLessonNotFoundError,
	WatchProgressCourseNotFoundError,
	WatchProgressValidationError,
} from "./watch-progress.types";

const COMPLETION_THRESHOLD = 0.95;

function toProgressPercent(lastPosition: number, duration: number): number {
	if (duration <= 0) {
		return 0;
	}
	return Math.round((lastPosition / duration) * 100);
}

function toEnvelope(row: typeof watchProgress.$inferSelect): ProgressEnvelope {
	return {
		progress: row,
		progressPercent: toProgressPercent(row.lastPosition, row.duration),
	};
}

function clampPosition(lastPosition: number, duration: number): number {
	if (duration <= 0) {
		throw new WatchProgressValidationError(
			"duration must be greater than zero"
		);
	}
	if (lastPosition < 0) {
		throw new WatchProgressValidationError("lastPosition must be non-negative");
	}
	return Math.min(lastPosition, duration);
}

function normalizeResumePosition(params: {
	lastPosition: number;
	duration: number | null;
}): number {
	const { lastPosition, duration } = params;
	if (duration === null || duration <= 0) {
		return Math.max(0, lastPosition);
	}
	return Math.min(Math.max(0, lastPosition), duration);
}

async function assertCourseExists(
	db: DbClient,
	courseId: string
): Promise<void> {
	const row = await db.query.course.findFirst({
		where: eq(course.id, courseId),
		columns: { id: true },
	});

	if (!row) {
		throw new WatchProgressCourseNotFoundError();
	}
}

async function assertCourseLessonExists(params: {
	db: DbClient;
	courseId: string;
	courseLessonId: string;
}): Promise<void> {
	const row = await params.db.query.courseLesson.findFirst({
		where: and(
			eq(courseLesson.id, params.courseLessonId),
			eq(courseLesson.courseId, params.courseId)
		),
		columns: { id: true },
	});

	if (!row) {
		throw new WatchProgressCourseLessonNotFoundError();
	}
}

function listPlayableCourseLessons(
	db: DbClient,
	courseId: string
): Promise<CourseLessonProgressSummary[]> {
	return db
		.select({
			id: courseLesson.id,
			courseId: courseLesson.courseId,
			lessonOrder: courseLesson.lessonOrder,
			title: courseLesson.title,
			description: courseLesson.description,
			thumbnailImageId: courseLesson.thumbnailImageId,
			duration: courseLesson.duration,
			releaseDate: courseLesson.releaseDate,
			fileId: courseLesson.fileId,
			addedAt: courseLesson.addedAt,
			createdAt: courseLesson.createdAt,
			updatedAt: courseLesson.updatedAt,
		})
		.from(courseLesson)
		.innerJoin(course, eq(courseLesson.courseId, course.id))
		.where(
			and(
				eq(courseLesson.courseId, courseId),
				eq(course.isDeleted, false),
				eq(course.isPublished, true),
				eq(course.isAvailable, true)
			)
		)
		.orderBy(
			asc(courseLesson.lessonOrder),
			asc(courseLesson.addedAt),
			asc(courseLesson.id)
		);
}

export async function saveWatchProgress(
	params: SaveWatchProgressParams
): Promise<ProgressEnvelope> {
	const { db, input } = params;

	await assertCourseExists(db, input.courseId);
	await assertCourseLessonExists({
		db,
		courseId: input.courseId,
		courseLessonId: input.courseLessonId,
	});

	const lastPosition = clampPosition(input.lastPosition, input.duration);
	const isCompleted = lastPosition / input.duration >= COMPLETION_THRESHOLD;

	const [saved] = await db
		.insert(watchProgress)
		.values({
			userId: input.userId,
			courseId: input.courseId,
			courseLessonId: input.courseLessonId,
			lastPosition,
			duration: input.duration,
			isCompleted,
			deviceType: input.deviceType ?? null,
		})
		.onConflictDoUpdate({
			target: [watchProgress.userId, watchProgress.courseLessonId],
			set: {
				courseId: input.courseId,
				lastPosition,
				duration: input.duration,
				isCompleted,
				deviceType: input.deviceType ?? null,
				updatedAt: new Date(),
			},
		})
		.returning();

	if (!saved) {
		throw new Error("Failed to save watch progress");
	}

	return toEnvelope(saved);
}

export async function markWatchProgressCompleted(
	params: MarkWatchProgressCompletedParams
): Promise<ProgressEnvelope> {
	const { db, input } = params;

	await assertCourseExists(db, input.courseId);
	await assertCourseLessonExists({
		db,
		courseId: input.courseId,
		courseLessonId: input.courseLessonId,
	});

	const existing = await db.query.watchProgress.findFirst({
		where: and(
			eq(watchProgress.userId, input.userId),
			eq(watchProgress.courseLessonId, input.courseLessonId)
		),
	});

	const duration = input.duration ?? existing?.duration ?? 1;
	if (duration <= 0) {
		throw new WatchProgressValidationError(
			"duration must be greater than zero"
		);
	}

	const [saved] = await db
		.insert(watchProgress)
		.values({
			userId: input.userId,
			courseId: input.courseId,
			courseLessonId: input.courseLessonId,
			lastPosition: duration,
			duration,
			isCompleted: true,
			deviceType: input.deviceType ?? existing?.deviceType ?? null,
		})
		.onConflictDoUpdate({
			target: [watchProgress.userId, watchProgress.courseLessonId],
			set: {
				courseId: input.courseId,
				lastPosition: duration,
				duration,
				isCompleted: true,
				deviceType: input.deviceType ?? existing?.deviceType ?? null,
				updatedAt: new Date(),
			},
		})
		.returning();

	if (!saved) {
		throw new Error("Failed to mark watch progress as completed");
	}

	return {
		progress: saved,
		progressPercent: 100,
	};
}

export async function getWatchProgressResume(
	params: GetWatchProgressResumeParams
): Promise<WatchProgressResumeResult | null> {
	const { db, input } = params;
	const row = await db.query.watchProgress.findFirst({
		where: and(
			eq(watchProgress.userId, input.userId),
			eq(watchProgress.courseLessonId, input.courseLessonId)
		),
	});

	if (!row) {
		return null;
	}

	return {
		...toEnvelope(row),
		resumePosition: row.lastPosition,
	};
}

export async function getCourseWatchProgressResume(
	params: GetCourseWatchProgressResumeParams
): Promise<CourseWatchProgressResumeResult | null> {
	const { db, input } = params;
	await assertCourseExists(db, input.courseId);

	const lessons = await listPlayableCourseLessons(db, input.courseId);
	if (lessons.length === 0) {
		return null;
	}

	const latestProgress = await db.query.watchProgress.findFirst({
		where: and(
			eq(watchProgress.userId, input.userId),
			eq(watchProgress.courseId, input.courseId)
		),
		orderBy: [desc(watchProgress.updatedAt), desc(watchProgress.id)],
	});

	const firstLesson = lessons[0];
	if (!firstLesson) {
		return null;
	}

	if (!latestProgress) {
		return {
			courseId: input.courseId,
			currentLesson: firstLesson,
			resumePosition: 0,
			nextLesson: lessons[1] ?? null,
			isCourseCompleted: false,
			lastWatchedCourseLessonId: null,
		};
	}

	const currentIndex = lessons.findIndex(
		(lesson) => lesson.id === latestProgress.courseLessonId
	);
	if (currentIndex < 0) {
		return {
			courseId: input.courseId,
			currentLesson: firstLesson,
			resumePosition: 0,
			nextLesson: lessons[1] ?? null,
			isCourseCompleted: false,
			lastWatchedCourseLessonId: latestProgress.courseLessonId,
		};
	}

	const currentLesson = lessons[currentIndex];
	if (!currentLesson) {
		return null;
	}
	const nextLesson = lessons[currentIndex + 1] ?? null;

	if (latestProgress.isCompleted && nextLesson) {
		return {
			courseId: input.courseId,
			currentLesson: nextLesson,
			resumePosition: 0,
			nextLesson: lessons[currentIndex + 2] ?? null,
			isCourseCompleted: false,
			lastWatchedCourseLessonId: latestProgress.courseLessonId,
		};
	}

	if (latestProgress.isCompleted && !nextLesson) {
		return {
			courseId: input.courseId,
			currentLesson,
			resumePosition: 0,
			nextLesson: null,
			isCourseCompleted: true,
			lastWatchedCourseLessonId: latestProgress.courseLessonId,
		};
	}

	return {
		courseId: input.courseId,
		currentLesson,
		resumePosition: normalizeResumePosition({
			lastPosition: latestProgress.lastPosition,
			duration: currentLesson.duration,
		}),
		nextLesson,
		isCourseCompleted: false,
		lastWatchedCourseLessonId: latestProgress.courseLessonId,
	};
}

export async function getCourseAutoPlayNext(
	params: GetCourseAutoPlayNextParams
): Promise<CourseAutoPlayNextResult> {
	const { db, input } = params;
	await assertCourseExists(db, input.courseId);
	await assertCourseLessonExists({
		db,
		courseId: input.courseId,
		courseLessonId: input.courseLessonId,
	});

	const lessons = await listPlayableCourseLessons(db, input.courseId);
	const currentIndex = lessons.findIndex(
		(lesson) => lesson.id === input.courseLessonId
	);

	if (currentIndex < 0) {
		throw new WatchProgressValidationError(
			"courseLessonId does not belong to a playable lesson in this course"
		);
	}

	const nextLesson = lessons[currentIndex + 1] ?? null;
	return {
		courseId: input.courseId,
		courseLessonId: input.courseLessonId,
		nextLesson,
		isCourseCompleted: nextLesson === null,
	};
}

export async function listContinueWatching(
	params: ListContinueWatchingParams
): Promise<ContinueWatchingResult> {
	const { db, input } = params;
	const page = input.page ?? 1;
	const limit = input.limit ?? 20;
	const offset = (page - 1) * limit;

	const where = and(
		eq(watchProgress.userId, input.userId),
		eq(watchProgress.isCompleted, false),
		eq(course.isDeleted, false),
		eq(course.isPublished, true),
		eq(course.isAvailable, true)
	);

	const countRows = await db
		.select({ total: count() })
		.from(watchProgress)
		.innerJoin(course, eq(watchProgress.courseId, course.id))
		.where(where);
	const total = Number(countRows[0]?.total ?? 0);

	const rows = await db
		.select({
			progress: watchProgress,
			course: {
				id: course.id,
				title: course.title,
				thumbnailImageId: course.thumbnailImageId,
			},
			lesson: {
				id: courseLesson.id,
				courseId: courseLesson.courseId,
				lessonOrder: courseLesson.lessonOrder,
				title: courseLesson.title,
				description: courseLesson.description,
				thumbnailImageId: courseLesson.thumbnailImageId,
				duration: courseLesson.duration,
				releaseDate: courseLesson.releaseDate,
				fileId: courseLesson.fileId,
				addedAt: courseLesson.addedAt,
				createdAt: courseLesson.createdAt,
				updatedAt: courseLesson.updatedAt,
			},
		})
		.from(watchProgress)
		.innerJoin(course, eq(watchProgress.courseId, course.id))
		.innerJoin(courseLesson, eq(watchProgress.courseLessonId, courseLesson.id))
		.where(where)
		.orderBy(desc(watchProgress.updatedAt), desc(watchProgress.id))
		.limit(limit)
		.offset(offset);

	const items: ContinueWatchingItem[] = rows.map((row) => ({
		progress: row.progress,
		progressPercent: toProgressPercent(
			row.progress.lastPosition,
			row.progress.duration
		),
		course: row.course,
		lesson: row.lesson,
	}));

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
