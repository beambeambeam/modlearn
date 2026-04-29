ALTER TABLE "order" ADD COLUMN "item_type" "cart_item_type";--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "content_id" uuid;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "playlist_id" uuid;--> statement-breakpoint
UPDATE "order" AS "o"
SET
	"item_type" = "oi"."item_type",
	"content_id" = "oi"."content_id",
	"playlist_id" = "oi"."playlist_id"
FROM (
	SELECT DISTINCT ON ("order_id")
		"order_id",
		"item_type",
		"content_id",
		"playlist_id"
	FROM "order_item"
	ORDER BY "order_id", "id"
) AS "oi"
WHERE "o"."id" = "oi"."order_id";--> statement-breakpoint
ALTER TABLE "order" ALTER COLUMN "item_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_content_id_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_playlist_id_playlist_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlist"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_contentId_idx" ON "order" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "order_playlistId_idx" ON "order" USING btree ("playlist_id");--> statement-breakpoint
ALTER TABLE "cart" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cart_item" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_item" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "cart" CASCADE;--> statement-breakpoint
DROP TABLE "cart_item" CASCADE;--> statement-breakpoint
DROP TABLE "order_item" CASCADE;--> statement-breakpoint
