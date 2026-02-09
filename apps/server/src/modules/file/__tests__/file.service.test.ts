import { eq } from "@modlearn/db/orm";
import { file, storage } from "@modlearn/db/schema/index";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { createTestUser } from "@/__tests__/helpers/factories";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "@/__tests__/helpers/test-db";
import {
	deleteObject,
	generateDownloadUrl,
	generateUploadUrl,
} from "@/lib/storage/s3-operations";
import {
	createFileDownloadUrl,
	createFileUploadRequest,
	deleteFile,
} from "@/modules/file/file.service";

vi.mock("@/lib/storage/s3-operations", () => ({
	generateUploadUrl: vi.fn(async (input: { key: string }) => ({
		uploadUrl: "https://example.com/upload",
		key: input.key,
		expiresAt: new Date("2026-02-09T00:00:00.000Z"),
	})),
	generateDownloadUrl: vi.fn(async (input: { key: string }) => ({
		downloadUrl: "https://example.com/download",
		expiresAt: new Date("2026-02-09T00:00:00.000Z"),
		key: input.key,
	})),
	deleteObject: vi.fn(async (input: { key: string }) => ({
		success: true,
		key: input.key,
	})),
}));

describe("file service", () => {
	let testDb: TestDatabase;

	beforeAll(async () => {
		testDb = await createTestDatabase();
	});

	beforeEach(async () => {
		await resetTestDatabase(testDb.client);
		vi.clearAllMocks();
	});

	afterAll(async () => {
		await testDb.cleanup();
	});

	describe("createFileUploadRequest", () => {
		it("creates file + storage rows and returns upload URL", async () => {
			const uploader = await createTestUser(testDb.client, {
				name: "Uploader",
				email: "uploader@example.com",
			});

			const input = {
				uploaderId: uploader.id,
				name: "intro.mp4",
				size: 1024,
				mimeType: "video/mp4",
				extension: "mp4",
				checksum: "a".repeat(64),
			};

			const result = await createFileUploadRequest({
				db: testDb.db,
				input,
			});

			expect(result.uploadUrl).toBe("https://example.com/upload");
			expect(result.fileId).toBeDefined();
			expect(result.storageKey).toBe(`files/${result.fileId}.mp4`);
			expect(result.expiresAt).toBeInstanceOf(Date);

			expect(generateUploadUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					key: `files/${result.fileId}.mp4`,
					contentType: "video/mp4",
					contentLength: 1024,
					checksum: "a".repeat(64),
				})
			);

			const [fileRow] = await testDb.db
				.select()
				.from(file)
				.where(eq(file.id, result.fileId));

			expect(fileRow).toMatchObject({
				name: "intro.mp4",
				size: 1024,
				mimeType: "video/mp4",
				extension: "mp4",
				checksum: "a".repeat(64),
				uploaderId: uploader.id,
				isDeleted: false,
			});

			const [storageRow] = await testDb.db
				.select()
				.from(storage)
				.where(eq(storage.fileId, result.fileId));

			expect(storageRow).toMatchObject({
				fileId: result.fileId,
				storageProvider: "s3",
				storageKey: `files/${result.fileId}.mp4`,
			});
		});
	});

	describe("createFileDownloadUrl", () => {
		it("returns a download URL for an existing file", async () => {
			const uploader = await createTestUser(testDb.client, {
				name: "Downloader",
				email: "downloader@example.com",
			});

			const [insertedFile] = await testDb.db
				.insert(file)
				.values({
					uploaderId: uploader.id,
					name: "lesson.mp4",
					size: 2048,
					mimeType: "video/mp4",
					extension: "mp4",
					checksum: "b".repeat(64),
				})
				.returning();

			if (!insertedFile) {
				throw new Error("Failed to create file row for test");
			}

			const storageKey = `files/${insertedFile.id}.mp4`;

			await testDb.db.insert(storage).values({
				fileId: insertedFile.id,
				storageProvider: "s3",
				storageKey,
			});

			const result = await createFileDownloadUrl({
				db: testDb.db,
				fileId: insertedFile.id,
			});

			expect(result.downloadUrl).toBe("https://example.com/download");
			expect(result.expiresAt).toBeInstanceOf(Date);
			expect(result.storageKey).toBe(storageKey);

			expect(generateDownloadUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					key: storageKey,
				})
			);
		});

		it("throws when file does not exist", async () => {
			await expect(
				createFileDownloadUrl({
					db: testDb.db,
					fileId: "00000000-0000-0000-0000-000000000000",
				})
			).rejects.toThrow();
		});

		it("throws when file is deleted", async () => {
			const uploader = await createTestUser(testDb.client, {
				name: "Deleted",
				email: "deleted@example.com",
			});

			const [insertedFile] = await testDb.db
				.insert(file)
				.values({
					uploaderId: uploader.id,
					name: "deleted.mp4",
					size: 4096,
					mimeType: "video/mp4",
					extension: "mp4",
					checksum: "c".repeat(64),
					isDeleted: true,
					deletedAt: new Date(),
				})
				.returning();

			if (!insertedFile) {
				throw new Error("Failed to create deleted file row for test");
			}

			await testDb.db.insert(storage).values({
				fileId: insertedFile.id,
				storageProvider: "s3",
				storageKey: `files/${insertedFile.id}.mp4`,
			});

			await expect(
				createFileDownloadUrl({
					db: testDb.db,
					fileId: insertedFile.id,
				})
			).rejects.toThrow();
		});
	});

	describe("deleteFile", () => {
		it("soft deletes a file and removes object from storage", async () => {
			const uploader = await createTestUser(testDb.client, {
				name: "Remover",
				email: "remover@example.com",
			});

			const [insertedFile] = await testDb.db
				.insert(file)
				.values({
					uploaderId: uploader.id,
					name: "cleanup.mp4",
					size: 8192,
					mimeType: "video/mp4",
					extension: "mp4",
					checksum: "d".repeat(64),
				})
				.returning();

			if (!insertedFile) {
				throw new Error("Failed to create file row for delete test");
			}

			const storageKey = `files/${insertedFile.id}.mp4`;

			await testDb.db.insert(storage).values({
				fileId: insertedFile.id,
				storageProvider: "s3",
				storageKey,
			});

			const result = await deleteFile({
				db: testDb.db,
				fileId: insertedFile.id,
			});

			expect(result.fileId).toBe(insertedFile.id);
			expect(result.deletedAt).toBeInstanceOf(Date);
			expect(result.storageKey).toBe(storageKey);

			expect(deleteObject).toHaveBeenCalledWith(
				expect.objectContaining({
					key: storageKey,
				})
			);

			const [fileRow] = await testDb.db
				.select()
				.from(file)
				.where(eq(file.id, insertedFile.id));

			expect(fileRow?.isDeleted).toBe(true);
			expect(fileRow?.deletedAt).toBeInstanceOf(Date);
		});

		it("throws when file does not exist", async () => {
			await expect(
				deleteFile({
					db: testDb.db,
					fileId: "00000000-0000-0000-0000-000000000000",
				})
			).rejects.toThrow();
		});
	});
});
