import { relations, sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { timestamps } from "./_helpers";
import { user } from "./auth";
import { course } from "./course";

export const courseReview = pgTable(
	"course_review",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		courseId: uuid("course_id")
			.notNull()
			.references(() => course.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		rating: integer("rating").notNull(),
		comment: text("comment"),
		isVisible: boolean("is_visible").default(true).notNull(),
		hiddenAt: timestamp("hidden_at", {
			withTimezone: true,
		}),
		hiddenBy: text("hidden_by").references(() => user.id, {
			onDelete: "set null",
		}),
		moderationReason: text("moderation_reason"),
		...timestamps,
	},
	(table) => [
		unique("courseReview_courseId_userId_unique").on(
			table.courseId,
			table.userId
		),
		check(
			"courseReview_rating_range_check",
			sql`${table.rating} between 1 and 5`
		),
		index("courseReview_courseId_idx").on(table.courseId),
		index("courseReview_userId_idx").on(table.userId),
		index("courseReview_courseId_visible_createdAt_idx").on(
			table.courseId,
			table.isVisible,
			table.createdAt
		),
		index("courseReview_courseId_rating_idx").on(table.courseId, table.rating),
	]
);

export const courseReviewRelations = relations(courseReview, ({ one }) => ({
	course: one(course, {
		fields: [courseReview.courseId],
		references: [course.id],
	}),
	author: one(user, {
		fields: [courseReview.userId],
		references: [user.id],
		relationName: "courseReviewAuthor",
	}),
	moderator: one(user, {
		fields: [courseReview.hiddenBy],
		references: [user.id],
		relationName: "courseReviewModerator",
	}),
}));
