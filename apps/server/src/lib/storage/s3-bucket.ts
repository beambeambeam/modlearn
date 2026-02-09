import { CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { z } from "zod";
import { s3Client } from "./s3-client";
import {
	bucketNameSchema,
	type CreateBucketResponse,
	type EnsureBucketExistsResponse,
	S3_ERROR_CODES,
	S3StorageError,
} from "./s3-types";

/**
 * Check if Bucket Exists
 *
 * Verifies if an S3 bucket exists by attempting to HEAD the bucket.
 *
 * @param bucketName The name of the bucket to check
 * @returns true if bucket exists, false if it doesn't exist
 * @throws S3StorageError for access denied, network errors, or other failures
 */
export async function bucketExists(bucketName: string): Promise<boolean> {
	try {
		const validated = bucketNameSchema.parse(bucketName);

		const command = new HeadBucketCommand({ Bucket: validated });
		await s3Client.send(command);

		return true;
	} catch (error) {
		if (error instanceof z.ZodError) {
			throw new S3StorageError(
				`Invalid bucket name: ${error.message}`,
				S3_ERROR_CODES.INVALID_KEY,
				error
			);
		}

		// Bucket doesn't exist - return false
		if (
			error &&
			typeof error === "object" &&
			"name" in error &&
			(error.name === "NotFound" || error.name === "NoSuchBucket")
		) {
			return false;
		}

		// Access denied error
		if (
			error &&
			typeof error === "object" &&
			"name" in error &&
			error.name === "AccessDenied"
		) {
			throw new S3StorageError(
				"Access denied to S3 bucket",
				S3_ERROR_CODES.ACCESS_DENIED,
				error
			);
		}

		// Network error
		if (
			error &&
			typeof error === "object" &&
			"name" in error &&
			error.name === "NetworkError"
		) {
			throw new S3StorageError(
				"Network error accessing S3",
				S3_ERROR_CODES.NETWORK_ERROR,
				error
			);
		}

		throw error;
	}
}

/**
 * Create Bucket
 *
 * Creates a new S3 bucket. If the bucket already exists (globally or owned by you),
 * returns success but indicates it wasn't created.
 *
 * @param bucketName The name of the bucket to create
 * @returns CreateBucketResponse with success status and whether it was actually created
 * @throws S3StorageError for access denied or other failures
 */
export async function createBucket(
	bucketName: string
): Promise<CreateBucketResponse> {
	try {
		const validated = bucketNameSchema.parse(bucketName);

		const command = new CreateBucketCommand({ Bucket: validated });
		await s3Client.send(command);

		return {
			success: true,
			bucketName: validated,
			created: true,
		};
	} catch (error) {
		if (error instanceof z.ZodError) {
			throw new S3StorageError(
				`Invalid bucket name: ${error.message}`,
				S3_ERROR_CODES.INVALID_KEY,
				error
			);
		}

		// Bucket already exists - not an error, but not created by us
		if (
			error &&
			typeof error === "object" &&
			"name" in error &&
			(error.name === "BucketAlreadyExists" ||
				error.name === "BucketAlreadyOwnedByYou")
		) {
			return {
				success: true,
				bucketName,
				created: false,
			};
		}

		// Access denied error
		if (
			error &&
			typeof error === "object" &&
			"name" in error &&
			error.name === "AccessDenied"
		) {
			throw new S3StorageError(
				"Access denied to create S3 bucket",
				S3_ERROR_CODES.ACCESS_DENIED,
				error
			);
		}

		// Wrap other errors
		throw new S3StorageError(
			`Failed to create bucket: ${error instanceof Error ? error.message : String(error)}`,
			S3_ERROR_CODES.UNKNOWN_ERROR,
			error
		);
	}
}

/**
 * Ensure Bucket Exists
 *
 * Idempotent operation that checks if a bucket exists and creates it if it doesn't.
 * Safe to call multiple times on server startup.
 *
 * @param bucketName The name of the bucket to ensure exists
 * @returns EnsureBucketExistsResponse with success status and whether it was created
 * @throws S3StorageError for access denied, network errors, or other failures
 */
export async function ensureBucketExists(
	bucketName: string
): Promise<EnsureBucketExistsResponse> {
	const exists = await bucketExists(bucketName);

	if (exists) {
		return {
			success: true,
			bucketName,
			created: false,
		};
	}

	return createBucket(bucketName);
}
