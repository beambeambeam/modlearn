ALTER TABLE "playlist" ADD COLUMN "is_published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "playlist" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "playlist" ADD COLUMN "is_available" boolean DEFAULT true NOT NULL;--> statement-breakpoint
UPDATE "playlist"
SET
	"is_published" = true,
	"is_available" = true,
	"published_at" = COALESCE("created_at", now());--> statement-breakpoint
CREATE INDEX "playlist_published_idx" ON "playlist" USING btree ("is_published","published_at");
