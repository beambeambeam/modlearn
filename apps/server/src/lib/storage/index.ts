/**
 * S3 Storage Module
 *
 * Provides presigned URL-based file upload/download for S3-compatible storage.
 * Uses RustFS (S3-compatible storage) running on port 9000.
 *
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

// biome-ignore lint/performance/noBarrelFile: Intentional public API surface
export {
	bucketExists,
	createBucket,
	ensureBucketExists,
} from "./s3-bucket";
export {
	deleteObject,
	generateDownloadUrl,
	generateUploadUrl,
	objectExists,
} from "./s3-operations";

// Types
export type {
	CreateBucketResponse,
	DeleteObjectResponse,
	DownloadUrlInput,
	EnsureBucketExistsResponse,
	ObjectExistsResponse,
	ObjectMetadata,
	PresignedDownloadResponse,
	PresignedUploadResponse,
	S3ErrorCode,
	UploadUrlInput,
} from "./s3-types";

// Constants and error class
export {
	ALLOWED_CONTENT_TYPES,
	bucketNameSchema,
	DEFAULT_DOWNLOAD_EXPIRATION,
	DEFAULT_UPLOAD_EXPIRATION,
	MAX_DOWNLOAD_EXPIRATION,
	MAX_FILE_SIZE,
	MAX_UPLOAD_EXPIRATION,
	S3_ERROR_CODES,
	S3StorageError,
} from "./s3-types";
