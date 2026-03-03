CREATE TYPE "public"."playback_event_type" AS ENUM('PLAY', 'PAUSE', 'RESUME', 'SEEK', 'STOP');--> statement-breakpoint
CREATE TYPE "public"."playback_session_status" AS ENUM('ACTIVE', 'PAUSED', 'STOPPED', 'ENDED', 'EXPIRED');--> statement-breakpoint
CREATE TABLE "playback_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"event_type" "playback_event_type" NOT NULL,
	"position" bigint DEFAULT 0 NOT NULL,
	"duration" bigint DEFAULT 0 NOT NULL,
	"device_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playback_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"content_id" uuid NOT NULL,
	"playlist_id" uuid,
	"playback_token" text NOT NULL,
	"status" "playback_session_status" DEFAULT 'ACTIVE' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_event_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"last_position" bigint DEFAULT 0 NOT NULL,
	"duration" bigint DEFAULT 0 NOT NULL,
	"device_type" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "playback_session_playback_token_unique" UNIQUE("playback_token")
);
--> statement-breakpoint
ALTER TABLE "playback_event" ADD CONSTRAINT "playback_event_session_id_playback_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."playback_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playback_session" ADD CONSTRAINT "playback_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playback_session" ADD CONSTRAINT "playback_session_content_id_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playback_session" ADD CONSTRAINT "playback_session_playlist_id_playlist_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlist"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "playbackEvent_sessionCreatedAt_idx" ON "playback_event" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "playbackEvent_typeCreatedAt_idx" ON "playback_event" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "playbackSession_userStatus_idx" ON "playback_session" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "playbackSession_contentId_idx" ON "playback_session" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "playbackSession_token_idx" ON "playback_session" USING btree ("playback_token");--> statement-breakpoint
CREATE INDEX "playbackSession_expiresAt_idx" ON "playback_session" USING btree ("expires_at");