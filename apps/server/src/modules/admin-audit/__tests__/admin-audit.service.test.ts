import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestUser } from "@/__tests__/helpers/factories";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "@/__tests__/helpers/test-db";
import { eq } from "@/lib/db/orm";
import { adminAuditLog } from "@/lib/db/schema";
import { createAdminAuditLog } from "../admin-audit.service";

describe("admin audit service", () => {
	let testDb: TestDatabase;

	beforeAll(async () => {
		testDb = await createTestDatabase();
	});

	beforeEach(async () => {
		await resetTestDatabase(testDb.client);
	});

	afterAll(async () => {
		await testDb.cleanup();
	});

	it("creates audit log with full fields", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "audit-admin-full@example.com",
			role: "admin",
		});

		const created = await createAdminAuditLog({
			db: testDb.db,
			input: {
				adminId: admin.id,
				entityId: "11111111-1111-1111-1111-111111111111",
				entityType: "CONTENT",
				action: "CREATE",
				metadata: { source: "test", count: 1 },
				ipAddress: "127.0.0.1",
			},
		});

		expect(created.adminId).toBe(admin.id);
		expect(created.entityType).toBe("CONTENT");
		expect(created.action).toBe("CREATE");
		expect(created.entityId).toBe("11111111-1111-1111-1111-111111111111");
		expect(created.metadata).toEqual({ source: "test", count: 1 });
		expect(created.ipAddress).toBe("127.0.0.1");
	});

	it("defaults metadata and ipAddress to null", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "audit-admin-nullable@example.com",
			role: "admin",
		});

		const created = await createAdminAuditLog({
			db: testDb.db,
			input: {
				adminId: admin.id,
				entityId: "22222222-2222-2222-2222-222222222222",
				entityType: "CATEGORY",
				action: "DELETE",
			},
		});

		const [row] = await testDb.db
			.select()
			.from(adminAuditLog)
			.where(eq(adminAuditLog.id, created.id));

		expect(row?.metadata).toBeNull();
		expect(row?.ipAddress).toBeNull();
	});
});
