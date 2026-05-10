import { relations } from "drizzle-orm";
import {
	bigint,
	boolean,
	index,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { session, user } from "./auth";
import { course, courseLesson } from "./course";

export const watchProgress = pgTable(
	"watch_progress",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		courseId: uuid("course_id")
			.notNull()
			.references(() => course.id, { onDelete: "cascade" }),
		courseLessonId: uuid("course_lesson_id")
			.notNull()
			.references(() => courseLesson.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		lastPosition: bigint("last_position", { mode: "number" }).notNull(),
		duration: bigint("duration", { mode: "number" }).notNull(),
		isCompleted: boolean("is_completed").default(false).notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
		deviceType: text("device_type"),
	},
	(table) => [
		index("watchProgress_userId_idx").on(table.userId),
		index("watchProgress_courseId_idx").on(table.courseId),
		index("watchProgress_courseLessonId_idx").on(table.courseLessonId),
		unique("watchProgress_userCourseLesson_unique").on(
			table.userId,
			table.courseLessonId
		),
		index("watchProgress_completed_idx").on(table.userId, table.isCompleted),
	]
);

export const courseLessonView = pgTable(
	"course_lesson_view",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		courseLessonId: uuid("course_lesson_id")
			.notNull()
			.references(() => courseLesson.id, { onDelete: "cascade" }),
		userId: text("user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		sessionId: text("session_id").references(() => session.id, {
			onDelete: "set null",
		}),
		viewedAt: timestamp("viewed_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		watchDuration: bigint("watch_duration", { mode: "number" }).default(0),
		deviceType: text("device_type"),
	},
	(table) => [
		index("courseLessonView_courseLessonId_idx").on(table.courseLessonId),
		index("courseLessonView_userId_idx").on(table.userId),
		index("courseLessonView_viewedAt_idx").on(table.viewedAt),
		index("courseLessonView_sessionId_idx").on(table.sessionId),
	]
);

export const watchProgressRelations = relations(watchProgress, ({ one }) => ({
	course: one(course, {
		fields: [watchProgress.courseId],
		references: [course.id],
	}),
	courseLesson: one(courseLesson, {
		fields: [watchProgress.courseLessonId],
		references: [courseLesson.id],
	}),
	user: one(user, {
		fields: [watchProgress.userId],
		references: [user.id],
	}),
}));

export const courseLessonViewRelations = relations(
	courseLessonView,
	({ one }) => ({
		courseLesson: one(courseLesson, {
			fields: [courseLessonView.courseLessonId],
			references: [courseLesson.id],
		}),
		user: one(user, {
			fields: [courseLessonView.userId],
			references: [user.id],
		}),
		session: one(session, {
			fields: [courseLessonView.sessionId],
			references: [session.id],
		}),
	})
);
