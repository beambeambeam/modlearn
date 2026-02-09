/**
 * Manual S3 Operations Test
 *
 * This script tests the complete upload/download/delete flow with real S3 (RustFS).
 *
 * Prerequisites:
 * 1. Docker running with RustFS: `bun run db:start`
 * 2. Bucket created: Access http://localhost:9001, login with rustfsadmin/rustfsadmin,
 *    create bucket named 'modlearn-media'
 * 3. Environment variables set in .env
 *
 * Run: bun run apps/server/src/lib/storage/__tests__/manual-test.ts
 */

import { randomUUID } from "node:crypto";
import {
	deleteObject,
	generateDownloadUrl,
	generateUploadUrl,
	objectExists,
} from "../index";

async function main() {
	console.log("🧪 Starting manual S3 operations test\n");

	// 1. Generate upload URL
	console.log("1️⃣  Generating upload URL...");
	const testKey = `test/${randomUUID()}.txt`;
	const testContent = "Hello S3! This is a test file.";
	const testContentType = "text/plain";

	const uploadResult = await generateUploadUrl({
		key: testKey,
		contentType: testContentType,
		contentLength: testContent.length,
	});

	console.log("   ✅ Upload URL generated");
	console.log(`   📝 Key: ${uploadResult.key}`);
	console.log(`   ⏰ Expires: ${uploadResult.expiresAt.toISOString()}`);
	console.log(`   🔗 URL: ${uploadResult.uploadUrl.substring(0, 100)}...`);

	// 2. Upload file (simulate client)
	console.log("\n2️⃣  Uploading file to presigned URL...");
	const uploadResponse = await fetch(uploadResult.uploadUrl, {
		method: "PUT",
		headers: {
			"Content-Type": testContentType,
			"Content-Length": testContent.length.toString(),
		},
		body: testContent,
	});

	if (!uploadResponse.ok) {
		throw new Error(
			`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`
		);
	}

	console.log("   ✅ File uploaded successfully");
	console.log(
		`   📊 Status: ${uploadResponse.status} ${uploadResponse.statusText}`
	);

	// 3. Verify upload
	console.log("\n3️⃣  Verifying upload...");
	const existsResult = await objectExists({ key: testKey });

	if (!existsResult.exists) {
		throw new Error("File not found after upload!");
	}

	console.log("   ✅ File exists in S3");
	console.log(`   📦 Size: ${existsResult.metadata?.size} bytes`);
	console.log(`   📄 Content-Type: ${existsResult.metadata?.contentType}`);
	console.log(
		`   🕒 Last Modified: ${existsResult.metadata?.lastModified?.toISOString()}`
	);
	console.log(`   🏷️  ETag: ${existsResult.metadata?.etag}`);

	// Verify content
	if (existsResult.metadata?.size !== testContent.length) {
		throw new Error(
			`File size mismatch! Expected ${testContent.length}, got ${existsResult.metadata?.size}`
		);
	}

	// 4. Generate download URL
	console.log("\n4️⃣  Generating download URL...");
	const downloadResult = await generateDownloadUrl({
		key: testKey,
		filename: "test-file.txt",
	});

	console.log("   ✅ Download URL generated");
	console.log(`   ⏰ Expires: ${downloadResult.expiresAt.toISOString()}`);
	console.log(`   🔗 URL: ${downloadResult.downloadUrl.substring(0, 100)}...`);

	// 5. Download and verify content
	console.log("\n5️⃣  Downloading file...");
	const downloadResponse = await fetch(downloadResult.downloadUrl);

	if (!downloadResponse.ok) {
		throw new Error(
			`Download failed: ${downloadResponse.status} ${downloadResponse.statusText}`
		);
	}

	const downloadedContent = await downloadResponse.text();
	console.log("   ✅ File downloaded successfully");
	console.log(`   📄 Content: "${downloadedContent}"`);

	if (downloadedContent !== testContent) {
		throw new Error(
			`Content mismatch! Expected "${testContent}", got "${downloadedContent}"`
		);
	}

	console.log("   ✅ Content matches original");

	// 6. Cleanup - delete object
	console.log("\n6️⃣  Deleting file...");
	const deleteResult = await deleteObject({ key: testKey });

	console.log("   ✅ File deleted");
	console.log(`   🗑️  Key: ${deleteResult.key}`);

	// 7. Verify deletion
	console.log("\n7️⃣  Verifying deletion...");
	const existsAfterDelete = await objectExists({ key: testKey });

	if (existsAfterDelete.exists) {
		throw new Error("File still exists after deletion!");
	}

	console.log("   ✅ File no longer exists in S3");

	// Success!
	console.log("\n✨ All tests passed! S3 operations working correctly.\n");
}

// Run the test
main().catch((error) => {
	console.error("\n❌ Test failed:");
	console.error(error);
	process.exit(1);
});
