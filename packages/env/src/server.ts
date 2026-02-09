import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		DATABASE_URL: z.string().min(1),
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_URL: z.url(),
		CORS_ORIGIN: z.url(),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
		// S3-Compatible Storage Configuration (RustFS)
		S3_ENDPOINT: z.string().url(),
		S3_ACCESS_KEY_ID: z.string().min(1),
		S3_SECRET_ACCESS_KEY: z.string().min(8),
		S3_BUCKET_NAME: z
			.string()
			.min(3)
			.max(63)
			.regex(
				/^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
				"Bucket name must be lowercase alphanumeric with hyphens"
			),
		S3_REGION: z.string().default("us-east-1"),
		S3_PUBLIC_URL: z.string().url(),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
