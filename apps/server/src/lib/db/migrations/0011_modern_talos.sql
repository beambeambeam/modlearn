CREATE TABLE "course_purchase" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"status" text NOT NULL,
	"order_id" uuid,
	CONSTRAINT "coursePurchase_userCourse_unique" UNIQUE("user_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "course" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"thumbnail_image_id" uuid,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"is_available" boolean DEFAULT true NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "courseCategory_unique" UNIQUE("course_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "course_lesson" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"lesson_order" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"thumbnail_image_id" uuid,
	"duration" bigint,
	"release_date" date,
	"file_id" uuid,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courseLesson_courseId_lessonOrder_unique" UNIQUE("course_id","lesson_order")
);
--> statement-breakpoint
CREATE TABLE "course_pricing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"currency" text NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_lesson_view" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_lesson_id" uuid NOT NULL,
	"user_id" text,
	"session_id" text,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"watch_duration" bigint DEFAULT 0,
	"device_type" text
);
--> statement-breakpoint
ALTER TABLE "content_purchase" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "content" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "content_category" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "content_pricing" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "playlist" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "playlist_content" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "playlist_episode" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "playlist_pricing" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "content_view" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "content_purchase" CASCADE;--> statement-breakpoint
DROP TABLE "content" CASCADE;--> statement-breakpoint
DROP TABLE "content_category" CASCADE;--> statement-breakpoint
DROP TABLE "content_pricing" CASCADE;--> statement-breakpoint
DROP TABLE "playlist" CASCADE;--> statement-breakpoint
DROP TABLE "playlist_content" CASCADE;--> statement-breakpoint
DROP TABLE "playlist_episode" CASCADE;--> statement-breakpoint
DROP TABLE "playlist_pricing" CASCADE;--> statement-breakpoint
DROP TABLE "content_view" CASCADE;--> statement-breakpoint
ALTER TABLE "user_library" DROP CONSTRAINT "userLibrary_userContent_unique";--> statement-breakpoint
ALTER TABLE "watch_progress" DROP CONSTRAINT "watchProgress_userContent_unique";--> statement-breakpoint
ALTER TABLE "order" ALTER COLUMN "item_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."cart_item_type";--> statement-breakpoint
CREATE TYPE "public"."cart_item_type" AS ENUM('COURSE');--> statement-breakpoint
ALTER TABLE "order" ALTER COLUMN "item_type" SET DATA TYPE "public"."cart_item_type" USING "item_type"::"public"."cart_item_type";--> statement-breakpoint
DROP INDEX "order_contentId_idx";--> statement-breakpoint
DROP INDEX "order_playlistId_idx";--> statement-breakpoint
DROP INDEX "userLibrary_contentId_idx";--> statement-breakpoint
DROP INDEX "watchProgress_contentId_idx";--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "course_id" uuid;--> statement-breakpoint
ALTER TABLE "user_library" ADD COLUMN "course_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "watch_progress" ADD COLUMN "course_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "watch_progress" ADD COLUMN "course_lesson_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "course_purchase" ADD CONSTRAINT "course_purchase_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_purchase" ADD CONSTRAINT "course_purchase_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_purchase" ADD CONSTRAINT "course_purchase_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course" ADD CONSTRAINT "course_creator_id_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course" ADD CONSTRAINT "course_thumbnail_image_id_file_id_fk" FOREIGN KEY ("thumbnail_image_id") REFERENCES "public"."file"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_category" ADD CONSTRAINT "course_category_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_category" ADD CONSTRAINT "course_category_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_lesson" ADD CONSTRAINT "course_lesson_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_lesson" ADD CONSTRAINT "course_lesson_thumbnail_image_id_file_id_fk" FOREIGN KEY ("thumbnail_image_id") REFERENCES "public"."file"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_lesson" ADD CONSTRAINT "course_lesson_file_id_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."file"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_pricing" ADD CONSTRAINT "course_pricing_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_pricing" ADD CONSTRAINT "course_pricing_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_lesson_view" ADD CONSTRAINT "course_lesson_view_course_lesson_id_course_lesson_id_fk" FOREIGN KEY ("course_lesson_id") REFERENCES "public"."course_lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_lesson_view" ADD CONSTRAINT "course_lesson_view_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_lesson_view" ADD CONSTRAINT "course_lesson_view_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coursePurchase_userId_idx" ON "course_purchase" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "coursePurchase_courseId_idx" ON "course_purchase" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "course_creatorId_idx" ON "course" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "course_published_idx" ON "course" USING btree ("is_published","published_at");--> statement-breakpoint
CREATE INDEX "course_deleted_idx" ON "course" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "courseCategory_courseId_idx" ON "course_category" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "courseCategory_categoryId_idx" ON "course_category" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "courseLesson_courseId_idx" ON "course_lesson" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "courseLesson_order_idx" ON "course_lesson" USING btree ("course_id","lesson_order");--> statement-breakpoint
CREATE INDEX "courseLesson_releaseDate_idx" ON "course_lesson" USING btree ("release_date");--> statement-breakpoint
CREATE INDEX "coursePricing_courseId_idx" ON "course_pricing" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "coursePricing_effective_idx" ON "course_pricing" USING btree ("effective_from","effective_to");--> statement-breakpoint
CREATE INDEX "courseLessonView_courseLessonId_idx" ON "course_lesson_view" USING btree ("course_lesson_id");--> statement-breakpoint
CREATE INDEX "courseLessonView_userId_idx" ON "course_lesson_view" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "courseLessonView_viewedAt_idx" ON "course_lesson_view" USING btree ("viewed_at");--> statement-breakpoint
CREATE INDEX "courseLessonView_sessionId_idx" ON "course_lesson_view" USING btree ("session_id");--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_library" ADD CONSTRAINT "user_library_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_course_lesson_id_course_lesson_id_fk" FOREIGN KEY ("course_lesson_id") REFERENCES "public"."course_lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_courseId_idx" ON "order" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "userLibrary_courseId_idx" ON "user_library" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "watchProgress_courseId_idx" ON "watch_progress" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "watchProgress_courseLessonId_idx" ON "watch_progress" USING btree ("course_lesson_id");--> statement-breakpoint
ALTER TABLE "order" DROP COLUMN "content_id";--> statement-breakpoint
ALTER TABLE "order" DROP COLUMN "playlist_id";--> statement-breakpoint
ALTER TABLE "user_library" DROP COLUMN "content_id";--> statement-breakpoint
ALTER TABLE "user_library" DROP COLUMN "playlist_id";--> statement-breakpoint
ALTER TABLE "watch_progress" DROP COLUMN "content_id";--> statement-breakpoint
ALTER TABLE "watch_progress" DROP COLUMN "playlist_id";--> statement-breakpoint
ALTER TABLE "user_library" ADD CONSTRAINT "userLibrary_userCourse_unique" UNIQUE("user_id","course_id");--> statement-breakpoint
ALTER TABLE "watch_progress" ADD CONSTRAINT "watchProgress_userCourseLesson_unique" UNIQUE("user_id","course_lesson_id");--> statement-breakpoint
DROP TYPE "public"."content_type";
