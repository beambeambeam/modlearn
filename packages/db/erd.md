# Entity Relationship Diagram (ERD)

## Table of Contents

1. [Overview](#overview)
2. [Core Tables](#core-tables)
   - [User](#user)
   - [Session](#session)
   - [Account](#account)
   - [Verification](#verification)
3. [Content Management](#content-management)
   - [Content](#content)
   - [Category](#category)
   - [Genre](#genre)
   - [ContentCategory](#contentcategory)
   - [ContentGenre](#contentgenre)
   - [ContentPricing](#contentpricing)
4. [Playlist Management](#playlist-management)
   - [Playlist](#playlist)
   - [PlaylistEpisode](#playlistepisode)
   - [PlaylistContent](#playlistcontent)
   - [PlaylistPricing](#playlistpricing)
5. [Media & Storage](#media--storage)
   - [File](#file)
   - [Storage](#storage)
6. [Purchase & Commerce](#purchase--commerce)
   - [Cart](#cart)
   - [CartItem](#cartitem)
   - [Order](#order)
   - [OrderItem](#orderitem)
   - [Payment](#payment)
   - [ContentPurchase](#contentpurchase)
   - [UserLibrary](#userlibrary)
7. [Streaming & Analytics](#streaming--analytics)
   - [StreamingToken](#streamingtoken)
   - [WatchProgress](#watchprogress)
   - [ContentView](#contentview)
8. [Administration](#administration)
   - [AdminAuditLog](#adminauditlog)

---

## Overview

This database supports a content streaming platform with the following key features:

- **User Authentication**: Email/password and OAuth-based authentication
- **Content Catalog**: Movies, series, episodes, and music with metadata
- **Playlist Management**: Series as ordered playlists with episodes
- **Purchase System**: Individual content and playlist purchases
- **Streaming**: Secure token-based video streaming with resume capability
- **Analytics**: View tracking and watch progress
- **Admin Tools**: Content management and audit logging

---

## Core Tables

### User

Stores user account information and profile data.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Unique user identifier |
| `name` | TEXT | NOT NULL | User's display name |
| `email` | TEXT | NOT NULL, UNIQUE | User's email address |
| `email_verified` | BOOLEAN | NOT NULL, DEFAULT false | Email verification status |
| `image` | TEXT | NULLABLE | Profile image URL |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Account creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |
| `username` | TEXT | UNIQUE | Unique username handle |
| `display_username` | TEXT | NULLABLE | Display version of username |
| `role` | TEXT | NULLABLE | User role (admin, user, etc.) |
| `banned` | BOOLEAN | DEFAULT false | Ban status |
| `ban_reason` | TEXT | NULLABLE | Reason for ban |
| `ban_expires` | TIMESTAMP | NULLABLE | Ban expiration timestamp |

**Indexes:**
- `user_email_idx` on `email`
- `user_username_idx` on `username`

---

### Session

Manages user sessions for authentication.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Session identifier |
| `expires_at` | TIMESTAMP | NOT NULL | Session expiration |
| `token` | TEXT | NOT NULL, UNIQUE | Session token |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL | Last update timestamp |
| `ip_address` | TEXT | NULLABLE | Client IP address |
| `user_agent` | TEXT | NULLABLE | Client user agent |
| `user_id` | TEXT | NOT NULL, FK → user.id | Associated user |
| `impersonated_by` | TEXT | NULLABLE | Admin impersonating user |

**Indexes:**
- `session_userId_idx` on `user_id`
- `session_token_idx` on `token`

---

### Account

Stores OAuth and third-party authentication provider accounts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Account identifier |
| `account_id` | TEXT | NOT NULL | Provider's account ID |
| `provider_id` | TEXT | NOT NULL | Provider name (google, github, etc.) |
| `user_id` | TEXT | NOT NULL, FK → user.id | Associated user |
| `access_token` | TEXT | NULLABLE | OAuth access token |
| `refresh_token` | TEXT | NULLABLE | OAuth refresh token |
| `id_token` | TEXT | NULLABLE | OIDC ID token |
| `access_token_expires_at` | TIMESTAMP | NULLABLE | Access token expiration |
| `refresh_token_expires_at` | TIMESTAMP | NULLABLE | Refresh token expiration |
| `scope` | TEXT | NULLABLE | OAuth scopes |
| `password` | TEXT | NULLABLE | Hashed password for credential provider |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL | Last update timestamp |

**Indexes:**
- `account_userId_idx` on `user_id`
- `account_provider_idx` on (`provider_id`, `account_id`)

---

### Verification

Stores verification tokens for email and password reset.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Verification identifier |
| `identifier` | TEXT | NOT NULL | What is being verified (email, password-reset) |
| `value` | TEXT | NOT NULL | Verification token value |
| `expires_at` | TIMESTAMP | NOT NULL | Token expiration |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL | Last update timestamp |

**Indexes:**
- `verification_identifier_idx` on `identifier`

---

## Content Management

### Content

Stores all content items (movies, series, episodes, music).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Content identifier |
| `title` | TEXT | NOT NULL | Content title |
| `description` | TEXT | NULLABLE | Content description |
| `thumbnail_image_id` | UUID | NULLABLE, FK → file.id | Thumbnail image reference |
| `duration` | BIGINT | NULLABLE | Duration in seconds |
| `is_available` | BOOLEAN | DEFAULT true | Availability status |
| `is_published` | BOOLEAN | DEFAULT false | Publication status |
| `published_at` | TIMESTAMP | NULLABLE | Publication timestamp |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL | Last update timestamp |
| `updated_by` | TEXT | NOT NULL, FK → user.id | Last editor |
| `release_date` | DATE | NULLABLE | Original release date |
| `content_type` | ENUM | NOT NULL | Type: MOVIE, SERIES, EPISODE, MUSIC |
| `view_count` | BIGINT | DEFAULT 0 | Total view count |
| `file_id` | UUID | NULLABLE, FK → file.id | Associated media file |

**Indexes:**
- `content_type_idx` on `content_type`
- `content_published_idx` on (`is_published`, `published_at`)
- `content_updatedBy_idx` on `updated_by`
- `content_releaseDate_idx` on `release_date`
- `content_viewCount_idx` on `view_count`

---

### Category

Content categories for organization.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Category identifier |
| `title` | TEXT | NOT NULL | Category name |
| `description` | TEXT | NULLABLE | Category description |
| `slug` | TEXT | UNIQUE | URL-friendly identifier |

**Indexes:**
- `category_slug_idx` on `slug`

---

### Genre

Content genres for classification.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Genre identifier |
| `title` | TEXT | NOT NULL | Genre name |
| `description` | TEXT | NULLABLE | Genre description |
| `slug` | TEXT | UNIQUE | URL-friendly identifier |

**Indexes:**
- `genre_slug_idx` on `slug`

---

### ContentCategory

Junction table for content-category many-to-many relationship.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Junction identifier |
| `content_id` | UUID | NOT NULL, FK → content.id | Associated content |
| `category_id` | UUID | NOT NULL, FK → category.id | Associated category |

**Indexes:**
- `contentCategory_contentId_idx` on `content_id`
- `contentCategory_categoryId_idx` on `category_id`
- `contentCategory_unique_idx` UNIQUE on (`content_id`, `category_id`)

---

### ContentGenre

Junction table for content-genre many-to-many relationship.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Junction identifier |
| `content_id` | UUID | NOT NULL, FK → content.id | Associated content |
| `genre_id` | UUID | NOT NULL, FK → genre.id | Associated genre |

**Indexes:**
- `contentGenre_contentId_idx` on `content_id`
- `contentGenre_genreId_idx` on `genre_id`
- `contentGenre_unique_idx` UNIQUE on (`content_id`, `genre_id`)

---

### ContentPricing

Pricing information for individual content items.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Pricing identifier |
| `content_id` | UUID | NOT NULL, FK → content.id | Associated content |
| `price` | DECIMAL | NOT NULL | Price amount |
| `currency` | TEXT | NOT NULL | Currency code (USD, EUR, etc.) |
| `effective_from` | TIMESTAMP | NOT NULL | Pricing effective start |
| `effective_to` | TIMESTAMP | NULLABLE | Pricing effective end |
| `created_by` | TEXT | NOT NULL, FK → user.id | Admin who set price |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |

**Indexes:**
- `contentPricing_contentId_idx` on `content_id`
- `contentPricing_effective_idx` on (`effective_from`, `effective_to`)

---

## Playlist Management

### Playlist

Series and collections of content.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Playlist identifier |
| `creator_id` | TEXT | NOT NULL, FK → user.id | Playlist creator |
| `title` | TEXT | NOT NULL | Playlist title |
| `description` | TEXT | NULLABLE | Playlist description |
| `thumbnail_image_id` | UUID | NULLABLE, FK → file.id | Thumbnail image |
| `is_series` | BOOLEAN | DEFAULT true | Is this a TV series |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL | Last update timestamp |

**Indexes:**
- `playlist_creatorId_idx` on `creator_id`
- `playlist_series_idx` on `is_series`

---

### PlaylistEpisode

Ordered episodes within a playlist/series.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Episode identifier |
| `playlist_id` | UUID | NOT NULL, FK → playlist.id | Parent playlist |
| `content_id` | UUID | NOT NULL, FK → content.id | Episode content |
| `episode_order` | INTEGER | NOT NULL | Display order (1, 2, 3...) |
| `season_number` | INTEGER | NULLABLE | Season number |
| `episode_number` | INTEGER | NULLABLE | Episode number within season |
| `title` | TEXT | NULLABLE | Episode-specific title |
| `added_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | When added to playlist |

**Indexes:**
- `playlistEpisode_playlistId_idx` on `playlist_id`
- `playlistEpisode_contentId_idx` on `content_id`
- `playlistEpisode_order_idx` on (`playlist_id`, `season_number`, `episode_order`)

---

### PlaylistContent

Tracks user progress within a playlist.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Record identifier |
| `playlist_id` | UUID | NOT NULL, FK → playlist.id | Associated playlist |
| `content_id` | UUID | NOT NULL, FK → content.id | Last watched content |
| `user_id` | TEXT | NOT NULL, FK → user.id | User progress |
| `is_latest_watched` | BOOLEAN | DEFAULT false | Is this the resume point |
| `updated_at` | TIMESTAMP | NOT NULL | Last update timestamp |

**Indexes:**
- `playlistContent_playlistId_idx` on `playlist_id`
- `playlistContent_userId_idx` on `user_id`
- `playlistContent_latest_idx` on (`user_id`, `playlist_id`, `is_latest_watched`)

---

### PlaylistPricing

Pricing information for playlists.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Pricing identifier |
| `playlist_id` | UUID | NOT NULL, FK → playlist.id | Associated playlist |
| `price` | DECIMAL | NOT NULL | Price amount |
| `currency` | TEXT | NOT NULL | Currency code |
| `effective_from` | DATE | NOT NULL | Effective start date |
| `effective_to` | DATE | NULLABLE | Effective end date |
| `created_by` | TEXT | NOT NULL, FK → user.id | Admin who set price |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |

**Indexes:**
- `playlistPricing_playlistId_idx` on `playlist_id`
- `playlistPricing_effective_idx` on (`effective_from`, `effective_to`)

---

## Media & Storage

### File

Metadata for uploaded files.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | File identifier |
| `uploader_id` | TEXT | NOT NULL, FK → user.id | Who uploaded |
| `uploaded_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Upload timestamp |
| `name` | TEXT | NOT NULL | Original filename |
| `size` | BIGINT | NOT NULL | File size in bytes |
| `mime_type` | TEXT | NOT NULL | MIME type |
| `extension` | TEXT | NOT NULL | File extension |
| `checksum` | TEXT | NOT NULL | File hash for integrity |
| `is_deleted` | BOOLEAN | DEFAULT false | Soft delete flag |
| `deleted_at` | TIMESTAMP | NULLABLE | Deletion timestamp |

**Indexes:**
- `file_uploaderId_idx` on `uploader_id`
- `file_checksum_idx` on `checksum`
- `file_deleted_idx` on `is_deleted`

---

### Storage

Physical storage location information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Storage identifier |
| `file_id` | UUID | NOT NULL, FK → file.id | Associated file |
| `storage_provider` | TEXT | NOT NULL | Provider (s3, gcs, azure) |
| `bucket` | TEXT | NULLABLE | Storage bucket name |
| `storage_key` | TEXT | NOT NULL | Unique key in storage |
| `cdn_url` | TEXT | NULLABLE | CDN delivery URL |

**Indexes:**
- `storage_fileId_idx` on `file_id`
- `storage_providerKey_idx` on (`storage_provider`, `storage_key`)

---

## Purchase & Commerce

### Cart

User shopping cart.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Cart identifier |
| `user_id` | TEXT | NOT NULL, FK → user.id | Cart owner |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL | Last update timestamp |

**Indexes:**
- `cart_userId_idx` on `user_id`

---

### CartItem

Individual items in a cart.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Item identifier |
| `cart_id` | UUID | NOT NULL, FK → cart.id | Parent cart |
| `content_id` | UUID | NULLABLE, FK → content.id | Content to purchase |
| `playlist_id` | UUID | NULLABLE, FK → playlist.id | Playlist to purchase |
| `item_type` | ENUM | NOT NULL | Type: CONTENT or PLAYLIST |
| `price` | DECIMAL | NOT NULL | Price at time of adding |
| `added_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | When added |

**Indexes:**
- `cartItem_cartId_idx` on `cart_id`
- `cartItem_contentId_idx` on `content_id`
- `cartItem_playlistId_idx` on `playlist_id`

---

### Order

Purchase orders.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Order identifier |
| `user_id` | TEXT | NOT NULL, FK → user.id | Order owner |
| `total_amount` | DECIMAL | NOT NULL | Total order amount |
| `currency` | TEXT | NOT NULL | Currency code |
| `status` | ENUM | NOT NULL | Status: PENDING, PAID, FAILED, REFUNDED |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL | Last update timestamp |

**Indexes:**
- `order_userId_idx` on `user_id`
- `order_status_idx` on `status`
- `order_createdAt_idx` on `created_at`

---

### OrderItem

Individual items within an order.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Item identifier |
| `order_id` | UUID | NOT NULL, FK → order.id | Parent order |
| `content_id` | UUID | NULLABLE, FK → content.id | Content purchased |
| `playlist_id` | UUID | NULLABLE, FK → playlist.id | Playlist purchased |
| `item_type` | ENUM | NOT NULL | Type: CONTENT or PLAYLIST |
| `price` | DECIMAL | NOT NULL | Price at purchase |

**Indexes:**
- `orderItem_orderId_idx` on `order_id`
- `orderItem_contentId_idx` on `content_id`
- `orderItem_playlistId_idx` on `playlist_id`

---

### Payment

Payment transaction records.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Payment identifier |
| `order_id` | UUID | NOT NULL, FK → order.id | Associated order |
| `provider_transaction_id` | TEXT | NOT NULL | Payment provider's transaction ID |
| `provider` | TEXT | NOT NULL | Payment provider (stripe, paypal) |
| `amount` | DECIMAL | NOT NULL | Payment amount |
| `currency` | TEXT | NOT NULL | Currency code |
| `status` | ENUM | NOT NULL | Status: INITIATED, SUCCESS, FAILED |
| `paid_at` | TIMESTAMP | NULLABLE | Payment completion timestamp |
| `failure_reason` | TEXT | NULLABLE | Reason if failed |

**Indexes:**
- `payment_orderId_idx` on `order_id`
- `payment_providerTransId_idx` on (`provider`, `provider_transaction_id`)
- `payment_status_idx` on `status`

---

### ContentPurchase

Direct content purchases (legacy/alternative to orders).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Purchase identifier |
| `content_id` | UUID | NOT NULL, FK → content.id | Content purchased |
| `user_id` | TEXT | NOT NULL, FK → user.id | Buyer |
| `purchased_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Purchase timestamp |
| `price` | DECIMAL | NOT NULL | Purchase price |
| `status` | TEXT | NOT NULL | Purchase status |
| `order_id` | UUID | NULLABLE, FK → order.id | Associated order |

**Indexes:**
- `contentPurchase_userId_idx` on `user_id`
- `contentPurchase_contentId_idx` on `content_id`
- `contentPurchase_userContent_idx` UNIQUE on (`user_id`, `content_id`)

---

### UserLibrary

User's purchased content library.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Library entry identifier |
| `user_id` | TEXT | NOT NULL, FK → user.id | Library owner |
| `content_id` | UUID | NOT NULL, FK → content.id | Purchased content |
| `playlist_id` | UUID | NULLABLE, FK → playlist.id | If from playlist purchase |
| `order_id` | UUID | NOT NULL, FK → order.id | Purchase order |
| `acquired_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | When added to library |
| `expires_at` | TIMESTAMP | NULLABLE | Access expiration (rentals) |

**Indexes:**
- `userLibrary_userId_idx` on `user_id`
- `userLibrary_contentId_idx` on `content_id`
- `userLibrary_orderId_idx` on `order_id`
- `userLibrary_userContent_idx` UNIQUE on (`user_id`, `content_id`)

---

## Streaming & Analytics

### StreamingToken

Secure tokens for video streaming authorization.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Token identifier |
| `content_id` | UUID | NOT NULL, FK → content.id | Content being streamed |
| `user_id` | TEXT | NOT NULL, FK → user.id | User requesting stream |
| `token` | TEXT | NOT NULL, UNIQUE | Secure token string |
| `expires_at` | TIMESTAMP | NOT NULL | Token expiration |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `ip_address` | TEXT | NULLABLE | IP that requested token |

**Indexes:**
- `streamingToken_token_idx` on `token`
- `streamingToken_userId_idx` on `user_id`
- `streamingToken_contentId_idx` on `content_id`
- `streamingToken_expiresAt_idx` on `expires_at`

---

### WatchProgress

User watch progress for resume functionality.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Progress identifier |
| `content_id` | UUID | NOT NULL, FK → content.id | Content being watched |
| `user_id` | TEXT | NOT NULL, FK → user.id | Watching user |
| `playlist_id` | UUID | NULLABLE, FK → playlist.id | If watching from playlist |
| `last_position` | BIGINT | NOT NULL | Last playback position (seconds) |
| `duration` | BIGINT | NOT NULL | Total content duration |
| `is_completed` | BOOLEAN | DEFAULT false | Whether finished |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update |
| `device_type` | TEXT | NULLABLE | Device used |

**Indexes:**
- `watchProgress_userId_idx` on `user_id`
- `watchProgress_contentId_idx` on `content_id`
- `watchProgress_userContent_idx` UNIQUE on (`user_id`, `content_id`)
- `watchProgress_completed_idx` on (`user_id`, `is_completed`)

---

### ContentView

Individual content view events for analytics.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | View identifier |
| `content_id` | UUID | NOT NULL, FK → content.id | Content viewed |
| `user_id` | TEXT | NULLABLE, FK → user.id | Viewer (null if guest) |
| `session_id` | UUID | NULLABLE, FK → session.id | Viewing session |
| `viewed_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | When viewed |
| `watch_duration` | BIGINT | DEFAULT 0 | How long watched (seconds) |
| `device_type` | TEXT | NULLABLE | Device type |

**Indexes:**
- `contentView_contentId_idx` on `content_id`
- `contentView_userId_idx` on `user_id`
- `contentView_viewedAt_idx` on `viewed_at`
- `contentView_sessionId_idx` on `session_id`

---

## Administration

### AdminAuditLog

Audit trail for admin actions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Log entry identifier |
| `admin_id` | TEXT | NOT NULL, FK → user.id | Admin who performed action |
| `entity_id` | UUID | NOT NULL | ID of affected entity |
| `entity_type` | TEXT | NOT NULL | Type of entity (content, user, etc.) |
| `action` | TEXT | NOT NULL | Action performed (create, update, delete) |
| `metadata` | JSONB | NULLABLE | Additional context |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | When action occurred |
| `ip_address` | TEXT | NULLABLE | Admin's IP address |

**Indexes:**
- `adminAuditLog_adminId_idx` on `admin_id`
- `adminAuditLog_entity_idx` on (`entity_type`, `entity_id`)
- `adminAuditLog_createdAt_idx` on `created_at`

---

## Relationships Summary

### One-to-Many Relationships

- **User** → Sessions (user has many sessions)
- **User** → Accounts (user has many OAuth accounts)
- **User** → Carts (user has one cart)
- **User** → Orders (user has many orders)
- **User** → WatchProgress (user has progress on many contents)
- **User** → ContentViews (user has many view events)
- **User** → UserLibrary (user owns many library items)
- **User** → Playlists (user creates many playlists)
- **Content** → ContentCategories (content has many categories)
- **Content** → ContentGenres (content has many genres)
- **Content** → StreamingTokens (content has many streaming sessions)
- **Content** → WatchProgress (content watched by many users)
- **Content** → ContentViews (content has many views)
- **Playlist** → PlaylistEpisodes (playlist has many episodes)
- **Playlist** → PlaylistContent (playlist tracked by many users)
- **Playlist** → PlaylistPricing (playlist has pricing history)
- **Category** → ContentCategories (category has many contents)
- **Genre** → ContentGenres (genre has many contents)
- **Order** → OrderItems (order has many items)
- **Order** → Payments (order has payment attempts)
- **Cart** → CartItems (cart has many items)
- **File** → Storage (file has storage locations)

### Many-to-Many Relationships

- **Content** ↔ **Category** (via ContentCategory)
- **Content** ↔ **Genre** (via ContentGenre)
- **Content** ↔ **Playlist** (via PlaylistEpisode)

### Self-Referencing

- **User** → User (impersonation via `impersonated_by`)

---

## Constraints & Business Rules

### Data Integrity

1. **Email Uniqueness**: User emails must be unique
2. **Username Uniqueness**: User usernames must be unique when provided
3. **Content Publication**: Content must have `published_at` set if `is_published` is true
4. **Playlist Episodes**: Episode order must be unique within a playlist
5. **User Library**: Each user-content pair can only exist once in library
6. **Watch Progress**: Each user-content pair can only have one progress record

### Soft Deletes

- **File**: Uses `is_deleted` flag instead of hard delete
- Preserves referential integrity while allowing recovery

### Cascading Deletes

- User deletion cascades to: Sessions, Accounts, Carts, Orders, WatchProgress, UserLibrary
- Content deletion should set related WatchProgress to archived
- Playlist deletion cascades to PlaylistEpisodes and PlaylistContent

### Validation Rules

1. **Streaming Tokens**: Must expire within 24 hours of creation
2. **Cart Items**: Must have either `content_id` or `playlist_id`, not both
3. **Order Items**: Must have either `content_id` or `playlist_id`, not both
4. **Effective Pricing**: `effective_to` must be after `effective_from` if set
5. **Watch Progress**: `last_position` must be less than or equal to `duration`

---

## Performance Considerations

### Frequently Queried Indexes

- Content lookup by type and publication status
- User library by user_id for "My Library" page
- Watch progress by user_id for "Continue Watching"
- Content views by content_id for analytics

### Partitioning Candidates

- **ContentView**: Could partition by `viewed_at` (monthly)
- **WatchProgress**: Could partition by `updated_at` (inactive users)
- **AdminAuditLog**: Should partition by `created_at` (monthly)

### Materialized Views

Consider creating for:
- Popular content (aggregated view counts)
- User viewing statistics
- Content availability with pricing
