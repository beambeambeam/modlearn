import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@modlearn/env/server";
import { z } from "zod";
import { s3Client } from "./s3-client";
import {
	type DeleteObjectResponse,
	type DownloadUrlInput,
	downloadUrlInputSchema,
	type ObjectExistsResponse,
	type PresignedDownloadResponse,
	type PresignedUploadResponse,
	S3_ERROR_CODES,
	S3StorageError,
	s3KeySchema,
	type UploadUrlInput,
	uploadUrlInputSchema,
} from "./s3-types";

/**
 * Generate Presigned Upload URL
 *
 * Creates a time-limited URL for uploading files directly to S3.
 * The client uploads directly to S3 without going through our server.
 *
 * @param params Upload parameters (key, contentType, contentLength, etc.)
 * @returns Presigned upload URL with expiration
 */
export async function generateUploadUrl(
	params: UploadUrlInput
): Promise<PresignedUploadResponse> {
	try {
		const validated = uploadUrlInputSchema.parse(params);

		const command = new PutObjectCommand({
			Bucket: env.S3_BUCKET_NAME,
			Key: validated.key,
			ContentType: validated.contentType,
			ContentLength: validated.contentLength,
			ChecksumSHA256: validated.checksum,
			Metadata: validated.metadata,
		});

		const uploadUrl = await getSignedUrl(s3Client, command, {
			expiresIn: validated.expiresIn,
		});

		return {
			uploadUrl,
			key: validated.key,
			expiresAt: new Date(Date.now() + validated.expiresIn * 1000),
		};
	} catch (error) {
		if (error instanceof z.ZodError) {
			throw new S3StorageError(
				`Invalid upload parameters: ${error.message}`,
				S3_ERROR_CODES.INVALID_KEY,
				error
			);
		}
		throw error;
	}
}

/**
 * Generate Presigned Download URL
 *
 * Creates a time-limited URL for downloading files from S3.
 * Supports optional filename suggestion and inline/attachment disposition.
 *
 * @param params Download parameters (key, optional filename, inline flag, expiration)
 * @returns Presigned download URL with expiration
 */
export async function generateDownloadUrl(
	params: DownloadUrlInput
): Promise<PresignedDownloadResponse> {
	try {
		const validated = downloadUrlInputSchema.parse(params);

		const command = new GetObjectCommand({
			Bucket: env.S3_BUCKET_NAME,
			Key: validated.key,
			ResponseContentDisposition: validated.filename
				? `${validated.inline ? "inline" : "attachment"}; filename="${validated.filename}"`
				: undefined,
		});

		const downloadUrl = await getSignedUrl(s3Client, command, {
			expiresIn: validated.expiresIn,
		});

		return {
			downloadUrl,
			expiresAt: new Date(Date.now() + validated.expiresIn * 1000),
		};
	} catch (error) {
		if (error instanceof z.ZodError) {
			throw new S3StorageError(
				`Invalid download parameters: ${error.message}`,
				S3_ERROR_CODES.INVALID_KEY,
				error
			);
		}
		throw error;
	}
}

/**
 * Delete Object
 *
 * Deletes an object from S3 storage.
 * S3 DeleteObject is idempotent - succeeds even if object doesn't exist.
 *
 * IMPORTANT: Always soft-delete in database first, then hard-delete from S3.
 * This ensures data integrity if S3 deletion fails.
 *
 * @param params Object key to delete
 * @returns Success status
 */
export async function deleteObject(params: {
	key: string;
}): Promise<DeleteObjectResponse> {
	try {
		const validated = z.object({ key: s3KeySchema }).parse(params);

		const command = new DeleteObjectCommand({
			Bucket: env.S3_BUCKET_NAME,
			Key: validated.key,
		});

		await s3Client.send(command);

		return {
			success: true,
			key: validated.key,
		};
	} catch (error) {
		if (error instanceof z.ZodError) {
			throw new S3StorageError(
				`Invalid key: ${error.message}`,
				S3_ERROR_CODES.INVALID_KEY,
				error
			);
		}

		// Map AWS SDK errors to semantic error codes
		if (error && typeof error === "object" && "name" in error) {
			if (error.name === "AccessDenied") {
				throw new S3StorageError(
					"Access denied to S3 object",
					S3_ERROR_CODES.ACCESS_DENIED,
					error
				);
			}
			if (error.name === "NetworkError") {
				throw new S3StorageError(
					"Network error accessing S3",
					S3_ERROR_CODES.NETWORK_ERROR,
					error
				);
			}
		}

		throw error;
	}
}

/**
 * Check if Object Exists
 *
 * Verifies if an object exists in S3 and retrieves its metadata.
 *
 * @param params Object key to check
 * @returns Existence status and metadata (if exists)
 */
export async function objectExists(params: {
	key: string;
}): Promise<ObjectExistsResponse> {
	try {
		const validated = z.object({ key: s3KeySchema }).parse(params);

		const command = new HeadObjectCommand({
			Bucket: env.S3_BUCKET_NAME,
			Key: validated.key,
		});

		const response = await s3Client.send(command);

		return {
			exists: true,
			metadata: {
				// biome-ignore lint: ContentLength is defined when object exists
				size: response.ContentLength!,
				// biome-ignore lint: ContentType is defined when object exists
				contentType: response.ContentType!,
				// biome-ignore lint: LastModified is defined when object exists
				lastModified: response.LastModified!,
				// biome-ignore lint: ETag is defined when object exists
				etag: response.ETag!,
			},
		};
	} catch (error) {
		if (error instanceof z.ZodError) {
			throw new S3StorageError(
				`Invalid key: ${error.message}`,
				S3_ERROR_CODES.INVALID_KEY,
				error
			);
		}

		// Object not found is expected - return false
		if (
			error &&
			typeof error === "object" &&
			"name" in error &&
			error.name === "NotFound"
		) {
			return { exists: false };
		}

		// Other errors should be thrown
		throw error;
	}
}
