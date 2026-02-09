import { S3Client } from "@aws-sdk/client-s3";
import { env } from "@modlearn/env/server";

/**
 * S3 Client Configuration
 *
 * Configured for S3-compatible storage (RustFS/MinIO).
 * Features:
 * - Path-style URLs (required for RustFS)
 * - Adaptive retry strategy (max 3 attempts)
 * - Connection and request timeouts
 * - Development logging
 */
export const s3Client = new S3Client({
	region: env.S3_REGION,
	endpoint: env.S3_ENDPOINT,
	credentials: {
		accessKeyId: env.S3_ACCESS_KEY_ID,
		secretAccessKey: env.S3_SECRET_ACCESS_KEY,
	},
	forcePathStyle: true, // CRITICAL: Required for S3-compatible services (RustFS/MinIO)
	requestHandler: {
		requestTimeout: 30_000, // 30 seconds for request completion
		connectionTimeout: 10_000, // 10 seconds for connection establishment
	},
	retryMode: "adaptive", // Adaptive retry strategy
	maxAttempts: 3, // Maximum 3 retry attempts
	logger: env.NODE_ENV === "development" ? console : undefined,
});
