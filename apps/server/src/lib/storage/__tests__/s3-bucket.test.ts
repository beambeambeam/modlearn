import { CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { beforeEach, describe, expect, it } from "vitest";
import { s3Mock } from "@/lib/storage/__tests__/helpers/s3-mock";
import { S3_ERROR_CODES, S3StorageError } from "@/lib/storage/s3-types";

describe("S3 Bucket Operations", () => {
	beforeEach(() => {
		s3Mock.reset();
	});

	describe("bucketExists", () => {
		it("should return true when bucket exists", async () => {
			const { bucketExists } = await import("../s3-bucket");

			s3Mock.on(HeadBucketCommand).resolves({});

			const result = await bucketExists("test-bucket");

			expect(result).toBe(true);
		});

		it("should return false when bucket does not exist", async () => {
			const { bucketExists } = await import("../s3-bucket");

			s3Mock
				.on(HeadBucketCommand)
				.rejects({ name: "NotFound", message: "Bucket not found" });

			const result = await bucketExists("non-existent-bucket");

			expect(result).toBe(false);
		});

		it("should return false on NoSuchBucket error", async () => {
			const { bucketExists } = await import("../s3-bucket");

			s3Mock
				.on(HeadBucketCommand)
				.rejects({ name: "NoSuchBucket", message: "Bucket does not exist" });

			const result = await bucketExists("missing-bucket");

			expect(result).toBe(false);
		});

		it("should throw S3StorageError with ACCESS_DENIED code on access denied", async () => {
			const { bucketExists } = await import("../s3-bucket");

			s3Mock
				.on(HeadBucketCommand)
				.rejects({ name: "AccessDenied", message: "Access Denied" });

			try {
				await bucketExists("test-bucket");
				expect.fail("Expected bucketExists to throw");
			} catch (error) {
				expect(error).toBeInstanceOf(S3StorageError);
				expect((error as S3StorageError).code).toBe(
					S3_ERROR_CODES.ACCESS_DENIED
				);
				expect((error as S3StorageError).message).toContain("Access denied");
			}
		});

		it("should throw S3StorageError with NETWORK_ERROR code on network error", async () => {
			const { bucketExists } = await import("../s3-bucket");

			s3Mock
				.on(HeadBucketCommand)
				.rejects({ name: "NetworkError", message: "Network Error" });

			try {
				await bucketExists("test-bucket");
				expect.fail("Expected bucketExists to throw");
			} catch (error) {
				expect(error).toBeInstanceOf(S3StorageError);
				expect((error as S3StorageError).code).toBe(
					S3_ERROR_CODES.NETWORK_ERROR
				);
				expect((error as S3StorageError).message).toContain("Network error");
			}
		});
	});

	describe("createBucket", () => {
		it("should successfully create a new bucket", async () => {
			const { createBucket } = await import("../s3-bucket");

			s3Mock.on(CreateBucketCommand).resolves({
				Location: "/test-bucket",
			});

			const result = await createBucket("test-bucket");

			expect(result.success).toBe(true);
			expect(result.bucketName).toBe("test-bucket");
			expect(result.created).toBe(true);
		});

		it("should handle bucket already exists error gracefully", async () => {
			const { createBucket } = await import("../s3-bucket");

			s3Mock
				.on(CreateBucketCommand)
				.rejects({ name: "BucketAlreadyExists", message: "Bucket exists" });

			const result = await createBucket("existing-bucket");

			expect(result.success).toBe(true);
			expect(result.bucketName).toBe("existing-bucket");
			expect(result.created).toBe(false);
		});

		it("should handle bucket already owned by you error gracefully", async () => {
			const { createBucket } = await import("../s3-bucket");

			s3Mock.on(CreateBucketCommand).rejects({
				name: "BucketAlreadyOwnedByYou",
				message: "Bucket already owned",
			});

			const result = await createBucket("my-bucket");

			expect(result.success).toBe(true);
			expect(result.bucketName).toBe("my-bucket");
			expect(result.created).toBe(false);
		});

		it("should throw S3StorageError with ACCESS_DENIED code on access denied", async () => {
			const { createBucket } = await import("../s3-bucket");

			s3Mock
				.on(CreateBucketCommand)
				.rejects({ name: "AccessDenied", message: "Access Denied" });

			try {
				await createBucket("test-bucket");
				expect.fail("Expected createBucket to throw");
			} catch (error) {
				expect(error).toBeInstanceOf(S3StorageError);
				expect((error as S3StorageError).code).toBe(
					S3_ERROR_CODES.ACCESS_DENIED
				);
			}
		});

		it("should throw S3StorageError for other errors", async () => {
			const { createBucket } = await import("../s3-bucket");

			s3Mock.on(CreateBucketCommand).rejects(new Error("Unknown error"));

			try {
				await createBucket("test-bucket");
				expect.fail("Expected createBucket to throw");
			} catch (error) {
				expect(error).toBeInstanceOf(S3StorageError);
				expect((error as S3StorageError).code).toBe(
					S3_ERROR_CODES.UNKNOWN_ERROR
				);
			}
		});
	});

	describe("ensureBucketExists", () => {
		it("should return success when bucket already exists", async () => {
			const { ensureBucketExists } = await import("../s3-bucket");

			s3Mock.on(HeadBucketCommand).resolves({});

			const result = await ensureBucketExists("existing-bucket");

			expect(result.success).toBe(true);
			expect(result.bucketName).toBe("existing-bucket");
			expect(result.created).toBe(false);
		});

		it("should create bucket when it does not exist", async () => {
			const { ensureBucketExists } = await import("../s3-bucket");

			s3Mock
				.on(HeadBucketCommand)
				.rejects({ name: "NotFound", message: "Bucket not found" });
			s3Mock.on(CreateBucketCommand).resolves({
				Location: "/new-bucket",
			});

			const result = await ensureBucketExists("new-bucket");

			expect(result.success).toBe(true);
			expect(result.bucketName).toBe("new-bucket");
			expect(result.created).toBe(true);
		});

		it("should handle errors during bucket creation", async () => {
			const { ensureBucketExists } = await import("../s3-bucket");

			s3Mock
				.on(HeadBucketCommand)
				.rejects({ name: "NotFound", message: "Bucket not found" });
			s3Mock
				.on(CreateBucketCommand)
				.rejects({ name: "AccessDenied", message: "Access Denied" });

			try {
				await ensureBucketExists("test-bucket");
				expect.fail("Expected ensureBucketExists to throw");
			} catch (error) {
				expect(error).toBeInstanceOf(S3StorageError);
				expect((error as S3StorageError).code).toBe(
					S3_ERROR_CODES.ACCESS_DENIED
				);
			}
		});
	});
});
