CREATE TYPE "public"."cart_item_type" AS ENUM('CONTENT', 'PLAYLIST');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('INITIATED', 'SUCCESS', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."content_type" AS ENUM('MOVIE', 'SERIES', 'EPISODE', 'MUSIC');--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"action" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text
);
--> statement-breakpoint
CREATE TABLE "cart" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" uuid NOT NULL,
	"content_id" uuid,
	"playlist_id" uuid,
	"item_type" "cart_item_type" NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_purchase" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"status" text NOT NULL,
	"order_id" uuid,
	CONSTRAINT "contentPurchase_userContent_unique" UNIQUE("user_id","content_id")
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"currency" text NOT NULL,
	"status" "order_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"content_id" uuid,
	"playlist_id" uuid,
	"item_type" "cart_item_type" NOT NULL,
	"price" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider_transaction_id" text NOT NULL,
	"provider" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text NOT NULL,
	"status" "payment_status" NOT NULL,
	"paid_at" timestamp with time zone,
	"failure_reason" text
);
--> statement-breakpoint
CREATE TABLE "user_library" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"content_id" uuid NOT NULL,
	"playlist_id" uuid,
	"order_id" uuid NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "userLibrary_userContent_unique" UNIQUE("user_id","content_id")
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"slug" text,
	CONSTRAINT "category_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"thumbnail_image_id" uuid,
	"duration" bigint,
	"is_available" boolean DEFAULT true NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL,
	"release_date" date,
	"content_type" "content_type" NOT NULL,
	"view_count" bigint DEFAULT 0 NOT NULL,
	"file_id" uuid
);
--> statement-breakpoint
CREATE TABLE "content_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "contentCategory_unique" UNIQUE("content_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "content_genre" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"genre_id" uuid NOT NULL,
	CONSTRAINT "contentGenre_unique" UNIQUE("content_id","genre_id")
);
--> statement-breakpoint
CREATE TABLE "content_pricing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"currency" text NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uploader_id" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"size" bigint NOT NULL,
	"mime_type" text NOT NULL,
	"extension" text NOT NULL,
	"checksum" text NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "genre" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"slug" text,
	CONSTRAINT "genre_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "storage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"storage_provider" text NOT NULL,
	"bucket" text,
	"storage_key" text NOT NULL,
	"cdn_url" text
);
--> statement-breakpoint
CREATE TABLE "playlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"thumbnail_image_id" uuid,
	"is_series" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playlist_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playlist_id" uuid NOT NULL,
	"content_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"is_latest_watched" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playlist_episode" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playlist_id" uuid NOT NULL,
	"content_id" uuid NOT NULL,
	"episode_order" integer NOT NULL,
	"season_number" integer,
	"episode_number" integer,
	"title" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playlist_pricing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playlist_id" uuid NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"currency" text NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_view" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"user_id" text,
	"session_id" text,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"watch_duration" bigint DEFAULT 0,
	"device_type" text
);
--> statement-breakpoint
CREATE TABLE "streaming_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	CONSTRAINT "streaming_token_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "watch_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"playlist_id" uuid,
	"last_position" bigint NOT NULL,
	"duration" bigint NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"device_type" text,
	CONSTRAINT "watchProgress_userContent_unique" UNIQUE("user_id","content_id")
);
--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_admin_id_user_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart" ADD CONSTRAINT "cart_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_cart_id_cart_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."cart"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_content_id_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_playlist_id_playlist_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_purchase" ADD CONSTRAINT "content_purchase_content_id_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_purchase" ADD CONSTRAINT "content_purchase_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_purchase" ADD CONSTRAINT "content_purchase_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_content_id_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_playlist_id_playlist_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlist"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_library" ADD CONSTRAINT "user_library_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_library" ADD CONSTRAINT "user_library_content_id_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_library" ADD CONSTRAINT "user_library_playlist_id_playlist_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlist"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_library" ADD CONSTRAINT "user_library_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content" ADD CONSTRAINT "content_thumbnail_image_id_file_id_fk" FOREIGN KEY ("thumbnail_image_id") REFERENCES "public"."file"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content" ADD CONSTRAINT "content_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content" ADD CONSTRAINT "content_file_id_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."file"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_category" ADD CONSTRAINT "content_category_content_id_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_category" ADD CONSTRAINT "content_category_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_genre" ADD CONSTRAINT "content_genre_content_id_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_genre" ADD CONSTRAINT "content_genre_genre_id_genre_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genre"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_pricing" ADD CONSTRAINT "content_pricing_content_id_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_pricing" ADD CONSTRAINT "content_pricing_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_uploader_id_user_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage" ADD CONSTRAINT "storage_file_id_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."file"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist" ADD CONSTRAINT "playlist_creator_id_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist" ADD CONSTRAINT "playlist_thumbnail_image_id_file_id_fk" FOREIGN KEY ("thumbnail_image_id") REFERENCES "public"."file"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_content" ADD CONSTRAINT "playlist_content_playlist_id_playlist_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_content" ADD CONSTRAINT "playlist_content_content_id_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_content" ADD CONSTRAINT "playlist_content_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_episode" ADD CONSTRAINT "playlist_episode_playlist_id_playlist_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_episode" ADD CONSTRAINT "playlist_episode_content_id_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_pricing" ADD CONSTRAINT "playlist_pricing_playlist_id_playlist_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_pricing" ADD CONSTRAINT "playlist_pricing_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_view" ADD CONSTRAINT "content_view_content_id_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_view" ADD CONSTRAINT "content_view_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_view" ADD CONSTRAINT "content_view_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streaming_token" ADD CONSTRAINT "streaming_token_content_id_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streaming_token" ADD CONSTRAINT "streaming_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_content_id_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_playlist_id_playlist_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlist"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "adminAuditLog_adminId_idx" ON "admin_audit_log" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "adminAuditLog_entity_idx" ON "admin_audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "adminAuditLog_createdAt_idx" ON "admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "cart_userId_idx" ON "cart" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cartItem_cartId_idx" ON "cart_item" USING btree ("cart_id");--> statement-breakpoint
CREATE INDEX "cartItem_contentId_idx" ON "cart_item" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "cartItem_playlistId_idx" ON "cart_item" USING btree ("playlist_id");--> statement-breakpoint
CREATE INDEX "contentPurchase_userId_idx" ON "content_purchase" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "contentPurchase_contentId_idx" ON "content_purchase" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "order_userId_idx" ON "order" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "order_status_idx" ON "order" USING btree ("status");--> statement-breakpoint
CREATE INDEX "order_createdAt_idx" ON "order" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orderItem_orderId_idx" ON "order_item" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orderItem_contentId_idx" ON "order_item" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "orderItem_playlistId_idx" ON "order_item" USING btree ("playlist_id");--> statement-breakpoint
CREATE INDEX "payment_orderId_idx" ON "payment" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payment_providerTransId_idx" ON "payment" USING btree ("provider","provider_transaction_id");--> statement-breakpoint
CREATE INDEX "payment_status_idx" ON "payment" USING btree ("status");--> statement-breakpoint
CREATE INDEX "userLibrary_userId_idx" ON "user_library" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "userLibrary_contentId_idx" ON "user_library" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "userLibrary_orderId_idx" ON "user_library" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "category_slug_idx" ON "category" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "content_type_idx" ON "content" USING btree ("content_type");--> statement-breakpoint
CREATE INDEX "content_published_idx" ON "content" USING btree ("is_published","published_at");--> statement-breakpoint
CREATE INDEX "content_updatedBy_idx" ON "content" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "content_releaseDate_idx" ON "content" USING btree ("release_date");--> statement-breakpoint
CREATE INDEX "content_viewCount_idx" ON "content" USING btree ("view_count");--> statement-breakpoint
CREATE INDEX "contentCategory_contentId_idx" ON "content_category" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "contentCategory_categoryId_idx" ON "content_category" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "contentGenre_contentId_idx" ON "content_genre" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "contentGenre_genreId_idx" ON "content_genre" USING btree ("genre_id");--> statement-breakpoint
CREATE INDEX "contentPricing_contentId_idx" ON "content_pricing" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "contentPricing_effective_idx" ON "content_pricing" USING btree ("effective_from","effective_to");--> statement-breakpoint
CREATE INDEX "file_uploaderId_idx" ON "file" USING btree ("uploader_id");--> statement-breakpoint
CREATE INDEX "file_checksum_idx" ON "file" USING btree ("checksum");--> statement-breakpoint
CREATE INDEX "file_deleted_idx" ON "file" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "genre_slug_idx" ON "genre" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "storage_fileId_idx" ON "storage" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "storage_providerKey_idx" ON "storage" USING btree ("storage_provider","storage_key");--> statement-breakpoint
CREATE INDEX "playlist_creatorId_idx" ON "playlist" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "playlist_series_idx" ON "playlist" USING btree ("is_series");--> statement-breakpoint
CREATE INDEX "playlistContent_playlistId_idx" ON "playlist_content" USING btree ("playlist_id");--> statement-breakpoint
CREATE INDEX "playlistContent_userId_idx" ON "playlist_content" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "playlistContent_latest_idx" ON "playlist_content" USING btree ("user_id","playlist_id","is_latest_watched");--> statement-breakpoint
CREATE INDEX "playlistEpisode_playlistId_idx" ON "playlist_episode" USING btree ("playlist_id");--> statement-breakpoint
CREATE INDEX "playlistEpisode_contentId_idx" ON "playlist_episode" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "playlistEpisode_order_idx" ON "playlist_episode" USING btree ("playlist_id","season_number","episode_order");--> statement-breakpoint
CREATE INDEX "playlistPricing_playlistId_idx" ON "playlist_pricing" USING btree ("playlist_id");--> statement-breakpoint
CREATE INDEX "playlistPricing_effective_idx" ON "playlist_pricing" USING btree ("effective_from","effective_to");--> statement-breakpoint
CREATE INDEX "contentView_contentId_idx" ON "content_view" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "contentView_userId_idx" ON "content_view" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "contentView_viewedAt_idx" ON "content_view" USING btree ("viewed_at");--> statement-breakpoint
CREATE INDEX "contentView_sessionId_idx" ON "content_view" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "streamingToken_token_idx" ON "streaming_token" USING btree ("token");--> statement-breakpoint
CREATE INDEX "streamingToken_userId_idx" ON "streaming_token" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "streamingToken_contentId_idx" ON "streaming_token" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "streamingToken_expiresAt_idx" ON "streaming_token" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "watchProgress_userId_idx" ON "watch_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "watchProgress_contentId_idx" ON "watch_progress" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "watchProgress_completed_idx" ON "watch_progress" USING btree ("user_id","is_completed");
