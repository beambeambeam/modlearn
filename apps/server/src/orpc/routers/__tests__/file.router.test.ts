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
import { adminAuditLog, file, storage } from "@/lib/db/schema";
import {
	createCaller,
	makeAuthenticatedContext,
	makeTestContext,
} from "@/orpc/__tests__/helpers";

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

describe("file router", () => {
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

	it("rejects file admin procedures for unauthenticated and non-admin users", async () => {
		const noSessionCaller = createCaller(makeTestContext({ db: testDb.db }));

		await expect(
			noSessionCaller.file.adminCreateUploadRequest({
				name: "video.mp4",
				size: 1024,
				mimeType: "video/mp4",
				extension: "mp4",
				checksum: "a".repeat(64),
			})
		).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));

		const user = await createTestUser(testDb.client, {
			email: "file-router-user@example.com",
			role: "user",
		});
		const userCaller = createCaller(
			makeAuthenticatedContext(user.id, "user", { db: testDb.db })
		);

		await expect(
			userCaller.file.adminDelete({
				fileId: "00000000-0000-0000-0000-000000000000",
			})
		).rejects.toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
	});

	it("rejects invalid input as BAD_REQUEST", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "file-router-admin-validate@example.com",
			role: "admin",
		});
		const adminCaller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);

		await expect(
			adminCaller.file.adminCreateUploadRequest({
				name: "video.mp4",
				size: 0,
				mimeType: "video/mp4",
				extension: "mp4",
				checksum: "a".repeat(64),
			})
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));

		await expect(
			adminCaller.file.adminCreateUploadRequest({
				name: "video.mp4",
				size: 1024,
				mimeType: "video/mp4",
				extension: "mp4",
				checksum: "short",
			})
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));

		await expect(
			adminCaller.file.adminGetDownloadUrl({
				fileId: "not-a-uuid",
			})
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
	});

	it("allows admin and superadmin to create upload URL, get download URL, and delete", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "file-router-admin@example.com",
			role: "admin",
		});
		const superadmin = await createTestUser(testDb.client, {
			email: "file-router-superadmin@example.com",
			role: "superadmin",
		});
		const adminCaller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);
		const superadminCaller = createCaller(
			makeAuthenticatedContext(superadmin.id, "superadmin", { db: testDb.db })
		);

		const upload = await adminCaller.file.adminCreateUploadRequest({
			name: "lesson.mp4",
			size: 2048,
			mimeType: "video/mp4",
			extension: "mp4",
			checksum: "a".repeat(64),
		});
		expect(upload.fileId).toBeDefined();
		expect(upload.storageKey).toBe(`files/${upload.fileId}.mp4`);
		expect(upload.uploadUrl).toBeDefined();
		expect(upload.expiresAt).toBeInstanceOf(Date);

		const auditAfterCreate = await testDb.db.select().from(adminAuditLog);
		const createAudit = auditAfterCreate.find(
			(row) =>
				row.entityType === "FILE" &&
				row.action === "CREATE" &&
				row.entityId === upload.fileId &&
				row.adminId === admin.id
		);
		expect(createAudit).toBeDefined();
		const auditCountBeforeDownload = auditAfterCreate.length;

		const download = await adminCaller.file.adminGetDownloadUrl({
			fileId: upload.fileId,
		});
		expect(download.storageKey).toBe(upload.storageKey);
		expect(download.downloadUrl).toBeDefined();
		expect(download.expiresAt).toBeInstanceOf(Date);

		const auditAfterDownload = await testDb.db.select().from(adminAuditLog);
		expect(auditAfterDownload).toHaveLength(auditCountBeforeDownload);

		const deleted = await superadminCaller.file.adminDelete({
			fileId: upload.fileId,
		});
		expect(deleted.fileId).toBe(upload.fileId);
		expect(deleted.storageKey).toBe(upload.storageKey);
		expect(deleted.deletedAt).toBeInstanceOf(Date);
	});

	it("maps missing/deleted targets to NOT_FOUND", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "file-router-admin-not-found@example.com",
			role: "admin",
		});
		const caller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);

		await expect(
			caller.file.adminGetDownloadUrl({
				fileId: "00000000-0000-0000-0000-000000000000",
			})
		).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));

		const [insertedFile] = await testDb.db
			.insert(file)
			.values({
				uploaderId: admin.id,
				name: "already-deleted.mp4",
				size: 100,
				mimeType: "video/mp4",
				extension: "mp4",
				checksum: "b".repeat(64),
				isDeleted: true,
				deletedAt: new Date("2026-01-01T00:00:00.000Z"),
			})
			.returning();
		if (!insertedFile) {
			throw new Error("failed to create deleted file fixture");
		}
		await testDb.db.insert(storage).values({
			fileId: insertedFile.id,
			storageProvider: "s3",
			storageKey: `files/${insertedFile.id}.mp4`,
		});

		await expect(
			caller.file.adminGetDownloadUrl({ fileId: insertedFile.id })
		).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));

		await expect(
			caller.file.adminDelete({ fileId: insertedFile.id })
		).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
	});
});
