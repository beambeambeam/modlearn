import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { beforeEach, describe, expect, it } from "vitest";
import type { UploadUrlInput } from "../s3-types";
import { S3_ERROR_CODES, S3StorageError } from "../s3-types";
import { s3Mock } from "./mocks/s3-mock";

describe("S3 Operations", () => {
	beforeEach(() => {
		s3Mock.reset();
	});

	describe("generateUploadUrl", () => {
		it("should generate a presigned upload URL with valid input", async () => {
			const { generateUploadUrl } = await import("../s3-operations");

			const input: UploadUrlInput = {
				key: "test/image.jpg",
				contentType: "image/jpeg",
				contentLength: 1024,
			};

			const result = await generateUploadUrl(input);

			expect(result).toHaveProperty("uploadUrl");
			expect(result).toHaveProperty("key", "test/image.jpg");
			expect(result).toHaveProperty("expiresAt");
			expect(result.uploadUrl).toContain("X-Amz-Algorithm");
			expect(result.uploadUrl).toContain("X-Amz-Credential");
			expect(result.expiresAt).toBeInstanceOf(Date);
		});

		it("should include custom metadata and checksum in presigned URL", async () => {
			const { generateUploadUrl } = await import("../s3-operations");

			const input: UploadUrlInput = {
				key: "test/document.pdf",
				contentType: "application/pdf",
				contentLength: 2048,
				checksum: "a".repeat(64), // Valid SHA-256 hex
				metadata: {
					userId: "user-123",
					uploadedBy: "test",
				},
				expiresIn: 600,
			};

			const result = await generateUploadUrl(input);

			expect(result.uploadUrl).toBeDefined();
			expect(result.key).toBe("test/document.pdf");
			// Verify expiration is approximately 600 seconds from now
			const expectedExpiry = new Date(Date.now() + 600 * 1000);
			expect(result.expiresAt.getTime()).toBeCloseTo(
				expectedExpiry.getTime(),
				-3
			); // Within 1 second
		});

		it("should reject invalid content type", async () => {
			const { generateUploadUrl } = await import("../s3-operations");

			const input = {
				key: "test/file.exe",
				contentType: "application/x-msdownload",
				contentLength: 1024,
			};

			await expect(
				generateUploadUrl(input as UploadUrlInput)
			).rejects.toThrow();
		});

		it("should reject file exceeding size limit", async () => {
			const { generateUploadUrl } = await import("../s3-operations");

			const input = {
				key: "test/large.mp4",
				contentType: "video/mp4",
				contentLength: 600 * 1024 * 1024, // 600 MB (exceeds 500 MB limit)
			};

			await expect(
				generateUploadUrl(input as UploadUrlInput)
			).rejects.toThrow();
		});

		it("should reject invalid S3 key format", async () => {
			const { generateUploadUrl } = await import("../s3-operations");

			const invalidKeys = [
				"/leading-slash.jpg",
				"trailing-slash/",
				"invalid@character.jpg",
				"", // Empty key
			];

			for (const key of invalidKeys) {
				const input = {
					key,
					contentType: "image/jpeg",
					contentLength: 1024,
				};

				await expect(
					generateUploadUrl(input as UploadUrlInput)
				).rejects.toThrow();
			}
		});

		it("should reject invalid checksum format", async () => {
			const { generateUploadUrl } = await import("../s3-operations");

			const input = {
				key: "test/file.jpg",
				contentType: "image/jpeg",
				contentLength: 1024,
				checksum: "invalid-checksum", // Not a valid SHA-256 hex
			};

			await expect(
				generateUploadUrl(input as UploadUrlInput)
			).rejects.toThrow();
		});

		it("should wrap Zod validation errors in S3StorageError with INVALID_KEY code", async () => {
			const { generateUploadUrl } = await import("../s3-operations");

			const input = {
				key: "",
				contentType: "image/jpeg",
				contentLength: 1024,
			};

			await expect(
				generateUploadUrl(input as UploadUrlInput)
			).rejects.toSatisfy((error: unknown) => {
				const err = error as S3StorageError;
				return (
					err instanceof S3StorageError &&
					err.code === S3_ERROR_CODES.INVALID_KEY &&
					err.message.includes("Invalid upload parameters")
				);
			});
		});
	});

	describe("generateDownloadUrl", () => {
		it("should generate a presigned download URL", async () => {
			const { generateDownloadUrl } = await import("../s3-operations");

			const result = await generateDownloadUrl({
				key: "test/image.jpg",
			});

			expect(result).toHaveProperty("downloadUrl");
			expect(result).toHaveProperty("expiresAt");
			expect(result.downloadUrl).toContain("X-Amz-Algorithm");
			expect(result.expiresAt).toBeInstanceOf(Date);
		});

		it("should include filename in Content-Disposition header", async () => {
			const { generateDownloadUrl } = await import("../s3-operations");

			const result = await generateDownloadUrl({
				key: "test/document.pdf",
				filename: "my-document.pdf",
			});

			expect(result.downloadUrl).toContain("response-content-disposition");
			expect(result.downloadUrl).toContain("my-document.pdf");
		});

		it("should use inline disposition when specified", async () => {
			const { generateDownloadUrl } = await import("../s3-operations");

			const result = await generateDownloadUrl({
				key: "test/image.jpg",
				filename: "preview.jpg",
				inline: true,
			});

			expect(result.downloadUrl).toContain("response-content-disposition");
			expect(result.downloadUrl).toContain("inline");
		});

		it("should use attachment disposition by default", async () => {
			const { generateDownloadUrl } = await import("../s3-operations");

			const result = await generateDownloadUrl({
				key: "test/file.pdf",
				filename: "download.pdf",
				inline: false,
			});

			expect(result.downloadUrl).toContain("response-content-disposition");
			expect(result.downloadUrl).toContain("attachment");
		});

		it("should respect custom expiration", async () => {
			const { generateDownloadUrl } = await import("../s3-operations");

			const result = await generateDownloadUrl({
				key: "test/file.pdf",
				expiresIn: 7200, // 2 hours
			});

			const expectedExpiry = new Date(Date.now() + 7200 * 1000);
			expect(result.expiresAt.getTime()).toBeCloseTo(
				expectedExpiry.getTime(),
				-3
			);
		});

		it("should reject invalid key", async () => {
			const { generateDownloadUrl } = await import("../s3-operations");

			await expect(
				generateDownloadUrl({ key: "/invalid/key" })
			).rejects.toThrow();
		});

		it("should wrap Zod validation errors in S3StorageError with INVALID_KEY code", async () => {
			const { generateDownloadUrl } = await import("../s3-operations");

			await expect(
				generateDownloadUrl({ key: "/invalid/key" })
			).rejects.toSatisfy((error: unknown) => {
				const err = error as S3StorageError;
				return (
					err instanceof S3StorageError &&
					err.code === S3_ERROR_CODES.INVALID_KEY &&
					err.message.includes("Invalid download parameters")
				);
			});
		});
	});

	describe("deleteObject", () => {
		it("should successfully delete an object", async () => {
			const { deleteObject } = await import("../s3-operations");

			s3Mock.resolves({});

			const result = await deleteObject({ key: "test/file.jpg" });

			expect(result.success).toBe(true);
			expect(result.key).toBe("test/file.jpg");
		});

		it("should succeed when deleting non-existent object (idempotent)", async () => {
			const { deleteObject } = await import("../s3-operations");

			s3Mock.resolves({});

			const result = await deleteObject({ key: "non-existent.jpg" });

			expect(result.success).toBe(true);
		});

		it("should reject invalid key", async () => {
			const { deleteObject } = await import("../s3-operations");

			await expect(deleteObject({ key: "" })).rejects.toThrow();
		});

		it("should throw S3StorageError with ACCESS_DENIED code on access denied", async () => {
			const { deleteObject } = await import("../s3-operations");

			s3Mock.rejects({ name: "AccessDenied", message: "Access Denied" });

			await expect(deleteObject({ key: "test/file.jpg" })).rejects.toSatisfy(
				(error: unknown) => {
					const err = error as S3StorageError;
					return (
						err instanceof S3StorageError &&
						err.code === S3_ERROR_CODES.ACCESS_DENIED &&
						err.message.includes("Access denied")
					);
				}
			);
		});

		it("should throw S3StorageError with NETWORK_ERROR code on network error", async () => {
			const { deleteObject } = await import("../s3-operations");

			s3Mock.rejects({ name: "NetworkError", message: "Network Error" });

			await expect(deleteObject({ key: "test/file.jpg" })).rejects.toSatisfy(
				(error: unknown) => {
					const err = error as S3StorageError;
					return (
						err instanceof S3StorageError &&
						err.code === S3_ERROR_CODES.NETWORK_ERROR &&
						err.message.includes("Network error")
					);
				}
			);
		});
	});

	describe("objectExists", () => {
		it("should return true with metadata for existing object", async () => {
			const { objectExists } = await import("../s3-operations");

			s3Mock.on(HeadObjectCommand).resolves({
				ContentLength: 2048,
				ContentType: "image/jpeg",
				LastModified: new Date("2024-01-01"),
				ETag: '"abc123"',
			});

			const result = await objectExists({ key: "test/existing.jpg" });

			expect(result.exists).toBe(true);
			expect(result.metadata).toBeDefined();
			expect(result.metadata?.size).toBe(2048);
			expect(result.metadata?.contentType).toBe("image/jpeg");
		});

		it("should return false for non-existent object", async () => {
			const { objectExists } = await import("../s3-operations");

			s3Mock.rejects({ name: "NotFound" });

			const result = await objectExists({ key: "non-existent.jpg" });

			expect(result.exists).toBe(false);
			expect(result.metadata).toBeUndefined();
		});

		it("should throw for other errors", async () => {
			const { objectExists } = await import("../s3-operations");

			s3Mock.rejects({ name: "AccessDenied", message: "Access Denied" });

			await expect(objectExists({ key: "test/file.jpg" })).rejects.toThrow();
		});

		it("should reject invalid key", async () => {
			const { objectExists } = await import("../s3-operations");

			await expect(objectExists({ key: "/invalid" })).rejects.toThrow();
		});
	});
});
