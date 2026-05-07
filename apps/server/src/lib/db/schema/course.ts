import { relations } from "drizzle-orm";
import {
	bigint,
	boolean,
	date,
	decimal,
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
import { category } from "./category";
import { file } from "./media";

export const course = pgTable(
	"course",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		creatorId: text("creator_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		description: text("description"),
		thumbnailImageId: uuid("thumbnail_image_id").references(() => file.id, {
			onDelete: "set null",
		}),
		isPublished: boolean("is_published").default(false).notNull(),
		publishedAt: timestamp("published_at", { withTimezone: true }),
		isAvailable: boolean("is_available").default(true).notNull(),
		isDeleted: boolean("is_deleted").default(false).notNull(),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		...timestamps,
	},
	(table) => [
		index("course_creatorId_idx").on(table.creatorId),
		index("course_published_idx").on(table.isPublished, table.publishedAt),
		index("course_deleted_idx").on(table.isDeleted),
	]
);

export const courseLesson = pgTable(
	"course_lesson",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		courseId: uuid("course_id")
			.notNull()
			.references(() => course.id, { onDelete: "cascade" }),
		lessonOrder: integer("lesson_order").notNull(),
		title: text("title").notNull(),
		description: text("description"),
		thumbnailImageId: uuid("thumbnail_image_id").references(() => file.id, {
			onDelete: "set null",
		}),
		duration: bigint("duration", { mode: "number" }),
		releaseDate: date("release_date", { mode: "date" }),
		fileId: uuid("file_id").references(() => file.id, {
			onDelete: "set null",
		}),
		addedAt: timestamp("added_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		...timestamps,
	},
	(table) => [
		index("courseLesson_courseId_idx").on(table.courseId),
		index("courseLesson_order_idx").on(table.courseId, table.lessonOrder),
		index("courseLesson_releaseDate_idx").on(table.releaseDate),
		unique("courseLesson_courseId_lessonOrder_unique").on(
			table.courseId,
			table.lessonOrder
		),
	]
);

export const courseCategory = pgTable(
	"course_category",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		courseId: uuid("course_id")
			.notNull()
			.references(() => course.id, { onDelete: "cascade" }),
		categoryId: uuid("category_id")
			.notNull()
			.references(() => category.id, { onDelete: "cascade" }),
	},
	(table) => [
		index("courseCategory_courseId_idx").on(table.courseId),
		index("courseCategory_categoryId_idx").on(table.categoryId),
		unique("courseCategory_unique").on(table.courseId, table.categoryId),
	]
);

export const coursePricing = pgTable(
	"course_pricing",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		courseId: uuid("course_id")
			.notNull()
			.references(() => course.id, { onDelete: "cascade" }),
		price: decimal("price", { precision: 10, scale: 2 }).notNull(),
		currency: text("currency").notNull(),
		effectiveFrom: timestamp("effective_from", {
			withTimezone: true,
		}).notNull(),
		effectiveTo: timestamp("effective_to", { withTimezone: true }),
		createdBy: text("created_by")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("coursePricing_courseId_idx").on(table.courseId),
		index("coursePricing_effective_idx").on(
			table.effectiveFrom,
			table.effectiveTo
		),
	]
);

export const courseRelations = relations(course, ({ one, many }) => ({
	creator: one(user, {
		fields: [course.creatorId],
		references: [user.id],
	}),
	thumbnailImage: one(file, {
		fields: [course.thumbnailImageId],
		references: [file.id],
		relationName: "courseThumbnailImage",
	}),
	courseLessons: many(courseLesson),
	courseCategories: many(courseCategory),
	coursePricings: many(coursePricing),
}));

export const courseCategoryRelations = relations(courseCategory, ({ one }) => ({
	course: one(course, {
		fields: [courseCategory.courseId],
		references: [course.id],
	}),
	category: one(category, {
		fields: [courseCategory.categoryId],
		references: [category.id],
	}),
}));

export const courseLessonRelations = relations(courseLesson, ({ one }) => ({
	course: one(course, {
		fields: [courseLesson.courseId],
		references: [course.id],
	}),
	thumbnailImage: one(file, {
		fields: [courseLesson.thumbnailImageId],
		references: [file.id],
		relationName: "courseLessonThumbnailImage",
	}),
	lessonFile: one(file, {
		fields: [courseLesson.fileId],
		references: [file.id],
		relationName: "courseLessonFile",
	}),
}));

export const coursePricingRelations = relations(coursePricing, ({ one }) => ({
	course: one(course, {
		fields: [coursePricing.courseId],
		references: [course.id],
	}),
	createdByUser: one(user, {
		fields: [coursePricing.createdBy],
		references: [user.id],
	}),
}));
