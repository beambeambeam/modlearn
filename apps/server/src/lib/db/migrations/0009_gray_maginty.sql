ALTER TABLE "content_view" DROP CONSTRAINT "content_view_playback_session_id_playback_session_id_fk";--> statement-breakpoint
ALTER TABLE "content_view" DROP CONSTRAINT "contentView_playbackSessionId_unique";--> statement-breakpoint
DROP INDEX "contentView_playbackSessionId_idx";--> statement-breakpoint
ALTER TABLE "content_view" DROP COLUMN "playback_session_id";--> statement-breakpoint
DROP TABLE "playback_event";--> statement-breakpoint
DROP TABLE "playback_session";--> statement-breakpoint
DROP TYPE "public"."playback_event_type";--> statement-breakpoint
DROP TYPE "public"."playback_session_status";
