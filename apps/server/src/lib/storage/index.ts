/**
 * S3 Storage Module
 *
 * Provides presigned URL-based file upload/download for S3-compatible storage.
 * Uses RustFS (S3-compatible storage) running on port 9000.
 *
 * Architecture:
 * - Clients upload/download directly to/from S3 using presigned URLs
 * - Server never handles file data (better scalability, lower latency)
 * - All S3 credentials stay server-side (security boundary)
 *
 * @example
 * ```typescript
 * import { generateUploadUrl, objectExists } from './lib/storage';
 *
 * // Generate upload URL for client
 * const { uploadUrl, key } = await generateUploadUrl({
 *   key: `uploads/${userId}/${filename}`,
 *   contentType: 'image/jpeg',
 *   contentLength: fileSize,
 * });
 *
 * // Verify upload succeeded
 * const { exists } = await objectExists({ key });
 * ```
 */

// Core operations
// biome-ignore lint/performance/noBarrelFile: Intentional public API surface
export {
	deleteObject,
	generateDownloadUrl,
	generateUploadUrl,
	objectExists,
} from "./s3-operations";

// Types
export type {
	DeleteObjectResponse,
	DownloadUrlInput,
	ObjectExistsResponse,
	ObjectMetadata,
	PresignedDownloadResponse,
	PresignedUploadResponse,
	S3ErrorCode,
	UploadUrlInput,
} from "./s3-types";
// Constants
// Error class
export {
	ALLOWED_CONTENT_TYPES,
	DEFAULT_DOWNLOAD_EXPIRATION,
	DEFAULT_UPLOAD_EXPIRATION,
	MAX_DOWNLOAD_EXPIRATION,
	MAX_FILE_SIZE,
	MAX_UPLOAD_EXPIRATION,
	S3_ERROR_CODES,
	S3StorageError,
} from "./s3-types";
