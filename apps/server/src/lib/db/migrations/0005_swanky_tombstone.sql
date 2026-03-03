ALTER TABLE "content_view" ADD COLUMN "playback_session_id" uuid;--> statement-breakpoint
ALTER TABLE "content_view" ADD CONSTRAINT "content_view_playback_session_id_playback_session_id_fk" FOREIGN KEY ("playback_session_id") REFERENCES "public"."playback_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contentView_playbackSessionId_idx" ON "content_view" USING btree ("playback_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contentView_playbackSessionId_unique" ON "content_view" USING btree ("playback_session_id");
