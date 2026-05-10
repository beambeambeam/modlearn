CREATE TABLE "course_review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"is_visible" boolean DEFAULT true NOT NULL,
	"hidden_at" timestamp with time zone,
	"hidden_by" text,
	"moderation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courseReview_courseId_userId_unique" UNIQUE("course_id","user_id"),
	CONSTRAINT "courseReview_rating_range_check" CHECK ("course_review"."rating" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "course_review" ADD CONSTRAINT "course_review_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_review" ADD CONSTRAINT "course_review_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_review" ADD CONSTRAINT "course_review_hidden_by_user_id_fk" FOREIGN KEY ("hidden_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "courseReview_courseId_idx" ON "course_review" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "courseReview_userId_idx" ON "course_review" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "courseReview_courseId_visible_createdAt_idx" ON "course_review" USING btree ("course_id","is_visible","created_at");--> statement-breakpoint
CREATE INDEX "courseReview_courseId_rating_idx" ON "course_review" USING btree ("course_id","rating");