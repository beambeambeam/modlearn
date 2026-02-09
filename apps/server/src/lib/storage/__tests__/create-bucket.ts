/**
 * Create S3 Bucket
 *
 * Creates the modlearn-media bucket in RustFS if it doesn't exist.
 */

import { CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { env } from "@modlearn/env/server";
import { s3Client } from "../s3-client";

async function createBucket() {
	const bucketName = env.S3_BUCKET_NAME;

	try {
		// Check if bucket exists
		console.log(`🔍 Checking if bucket "${bucketName}" exists...`);
		await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
		console.log(`✅ Bucket "${bucketName}" already exists`);
		return;
	} catch (error) {
		if (
			error &&
			typeof error === "object" &&
			"name" in error &&
			(error.name === "NotFound" || error.name === "NoSuchBucket")
		) {
			// Bucket doesn't exist, create it
			console.log(`📦 Creating bucket "${bucketName}"...`);
			await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
			console.log(`✅ Bucket "${bucketName}" created successfully`);
			return;
		}
		throw error;
	}
}

createBucket()
	.then(() => {
		console.log("\n✨ Ready to use S3 storage!");
		process.exit(0);
	})
	.catch((error) => {
		console.error("\n❌ Failed to create bucket:");
		console.error(error);
		process.exit(1);
	});
