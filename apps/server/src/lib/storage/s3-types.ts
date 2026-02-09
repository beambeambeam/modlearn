import { z } from "zod";

/**
 * S3 Key Validation
 *
 * S3 keys must:
 * - Be 1-1024 characters long
 * - Use safe characters: alphanumeric, !, -, _, ., *, ', (, ), /
 * - Not start or end with slashes (enforced by refine)
 *
 * Reference: https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html
 */
export const s3KeySchema = z
	.string()
	.min(1, "S3 key cannot be empty")
	.max(1024, "S3 key exceeds maximum length of 1024 characters")
	.regex(
		/^[a-zA-Z0-9!\-_.*'()/]+$/,
		"S3 key contains invalid characters. Allowed: alphanumeric, !, -, _, ., *, ', (, ), /"
	)
	.refine(
		(key) => !(key.startsWith("/") || key.endsWith("/")),
		"S3 key cannot start or end with a slash"
	);

/**
 * Allowed Content Types
 *
 * Restricts uploads to specific MIME types for security.
 * Prevents MIME confusion attacks and ensures only expected file types are stored.
 */
export const ALLOWED_CONTENT_TYPES = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/gif",
	"video/mp4",
	"video/webm",
	"video/quicktime", // .mov files
	"application/pdf",
	"text/plain",
] as const;

/**
 * File Size Limits
 *
 * Maximum file size: 500 MB (suitable for video files)
 * Adjust based on your infrastructure and use case.
 */
export const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB in bytes

/**
 * Presigned URL Expiration Times (in seconds)
 */
export const DEFAULT_UPLOAD_EXPIRATION = 900; // 15 minutes
export const DEFAULT_DOWNLOAD_EXPIRATION = 3600; // 1 hour
export const MAX_UPLOAD_EXPIRATION = 3600; // 1 hour max
export const MAX_DOWNLOAD_EXPIRATION = 86_400; // 24 hours max

/**
 * Upload URL Input Schema
 *
 * Validates parameters for generating a presigned upload URL.
 * Enforces content-type restrictions and file size limits.
 */
export const uploadUrlInputSchema = z.object({
	key: s3KeySchema,
	contentType: z
		.string()
		.refine(
			(type) => ALLOWED_CONTENT_TYPES.includes(type as never),
			"Content type not allowed"
		),
	contentLength: z
		.number()
		.int("Content length must be an integer")
		.positive("Content length must be positive")
		.max(MAX_FILE_SIZE, `File size exceeds maximum of ${MAX_FILE_SIZE} bytes`),
	checksum: z
		.string()
		.regex(/^[a-f0-9]{64}$/, "Checksum must be a valid SHA-256 hash")
		.optional(),
	metadata: z.record(z.string(), z.string()).optional(),
	expiresIn: z
		.number()
		.int()
		.positive()
		.max(MAX_UPLOAD_EXPIRATION)
		.optional()
		.default(DEFAULT_UPLOAD_EXPIRATION),
});

export type UploadUrlInput = z.input<typeof uploadUrlInputSchema>;

/**
 * Download URL Input Schema
 *
 * Validates parameters for generating a presigned download URL.
 */
export const downloadUrlInputSchema = z.object({
	key: s3KeySchema,
	expiresIn: z
		.number()
		.int()
		.positive()
		.max(MAX_DOWNLOAD_EXPIRATION)
		.optional()
		.default(DEFAULT_DOWNLOAD_EXPIRATION),
	filename: z.string().max(255).optional(),
	inline: z.boolean().optional().default(false),
});

export type DownloadUrlInput = z.input<typeof downloadUrlInputSchema>;

/**
 * Object Metadata
 *
 * Information returned when checking if an object exists.
 */
export interface ObjectMetadata {
	size: number;
	contentType: string;
	lastModified: Date;
	etag: string;
}

/**
 * Presigned Upload Response
 */
export interface PresignedUploadResponse {
	uploadUrl: string;
	key: string;
	expiresAt: Date;
}

/**
 * Presigned Download Response
 */
export interface PresignedDownloadResponse {
	downloadUrl: string;
	expiresAt: Date;
}

/**
 * Object Exists Response
 */
export interface ObjectExistsResponse {
	exists: boolean;
	metadata?: ObjectMetadata;
}

/**
 * Delete Object Response
 */
export interface DeleteObjectResponse {
	success: boolean;
	key: string;
}

/**
 * S3 Storage Error Codes
 */
export const S3_ERROR_CODES = {
	INVALID_KEY: "INVALID_KEY",
	INVALID_CONTENT_TYPE: "INVALID_CONTENT_TYPE",
	FILE_TOO_LARGE: "FILE_TOO_LARGE",
	OBJECT_NOT_FOUND: "OBJECT_NOT_FOUND",
	BUCKET_NOT_FOUND: "BUCKET_NOT_FOUND",
	ACCESS_DENIED: "ACCESS_DENIED",
	NETWORK_ERROR: "NETWORK_ERROR",
	UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const;

export type S3ErrorCode = (typeof S3_ERROR_CODES)[keyof typeof S3_ERROR_CODES];

/**
 * Custom S3 Storage Error
 *
 * Wraps AWS SDK errors with semantic error codes.
 */
export class S3StorageError extends Error {
	code: S3ErrorCode;
	override cause?: unknown;

	constructor(message: string, code: S3ErrorCode, cause?: unknown) {
		super(message);
		this.name = "S3StorageError";
		this.code = code;
		this.cause = cause;
	}
}

/**
 * Bucket Name Validation
 *
 * S3 bucket names must:
 * - Be 3-63 characters long
 * - Consist only of lowercase letters, numbers, hyphens, and underscores
 * - Start and end with a letter or number
 *
 * Reference: https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucketnamingrules.html
 */
export const bucketNameSchema = z
	.string()
	.min(3, "Bucket name must be at least 3 characters")
	.max(63, "Bucket name must be at most 63 characters")
	.regex(
		/^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
		"Bucket name must be lowercase alphanumeric with hyphens"
	);

/**
 * Create Bucket Response
 */
export interface CreateBucketResponse {
	success: boolean;
	bucketName: string;
	created: boolean;
}

/**
 * Ensure Bucket Exists Response
 */
export interface EnsureBucketExistsResponse extends CreateBucketResponse {}
