import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestUser } from "@/__tests__/helpers/factories";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "@/__tests__/helpers/test-db";
import { adminAuditLog } from "@/lib/db/schema";
import {
	createCaller,
	makeAuthenticatedContext,
	makeTestContext,
} from "@/orpc/__tests__/helpers";

async function createAuditLogFixture(params: {
	testDb: TestDatabase;
	adminId: string;
	entityId: string;
	entityType: "CONTENT" | "CATEGORY" | "FILE" | "PLAYLIST" | "PLAYLIST_EPISODE";
	action:
		| "CREATE"
		| "UPDATE"
		| "DELETE"
		| "SET_PUBLISH_STATE"
		| "SET_AVAILABILITY"
		| "SET_CLASSIFICATION"
		| "ADD_EPISODE"
		| "REORDER_EPISODES"
		| "UPDATE_EPISODE"
		| "REMOVE_EPISODE";
	createdAt?: Date;
	metadata?: Record<string, unknown> | null;
}) {
	const { testDb, adminId, entityId, entityType, action, createdAt, metadata } =
		params;

	const [row] = await testDb.db
		.insert(adminAuditLog)
		.values({
			adminId,
			entityId,
			entityType,
			action,
			createdAt: createdAt ?? new Date(),
			metadata: metadata ?? null,
			ipAddress: null,
		})
		.returning();

	if (!row) {
		throw new Error("Failed to create admin audit fixture");
	}

	return row;
}

describe("admin audit router", () => {
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

	it("rejects unauthenticated access", async () => {
		const caller = createCaller(makeTestContext({ db: testDb.db }));

		await expect(caller.adminAudit.list({})).rejects.toThrow(
			expect.objectContaining({ code: "UNAUTHORIZED" })
		);
	});

	it("rejects non-admin access", async () => {
		const user = await createTestUser(testDb.client, {
			email: "admin-audit-router-user@example.com",
		});
		const caller = createCaller(
			makeAuthenticatedContext(user.id, "user", { db: testDb.db })
		);

		await expect(caller.adminAudit.list({})).rejects.toThrow(
			expect.objectContaining({ code: "FORBIDDEN" })
		);
	});

	it("allows admin and superadmin access", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "admin-audit-router-admin@example.com",
			role: "admin",
		});
		const superadmin = await createTestUser(testDb.client, {
			email: "admin-audit-router-superadmin@example.com",
			role: "superadmin",
		});
		await createAuditLogFixture({
			testDb,
			adminId: admin.id,
			entityId: "11111111-1111-4111-8111-111111111111",
			entityType: "CONTENT",
			action: "CREATE",
		});

		const adminCaller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);
		const superadminCaller = createCaller(
			makeAuthenticatedContext(superadmin.id, "superadmin", { db: testDb.db })
		);

		const adminResult = await adminCaller.adminAudit.list({});
		const superadminResult = await superadminCaller.adminAudit.list({});

		expect(adminResult.items).toHaveLength(1);
		expect(superadminResult.items).toHaveLength(1);
		expect(adminResult.items[0]?.admin.email).toBe(admin.email);
	});

	it("returns newest-first ordering and pagination metadata", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "admin-audit-router-order@example.com",
			role: "admin",
		});
		const caller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);

		const older = await createAuditLogFixture({
			testDb,
			adminId: admin.id,
			entityId: "22222222-2222-4222-8222-222222222222",
			entityType: "CONTENT",
			action: "CREATE",
			createdAt: new Date("2025-01-01T00:00:00.000Z"),
		});
		const newer = await createAuditLogFixture({
			testDb,
			adminId: admin.id,
			entityId: "33333333-3333-4333-8333-333333333333",
			entityType: "CATEGORY",
			action: "UPDATE",
			createdAt: new Date("2025-01-02T00:00:00.000Z"),
		});

		const result = await caller.adminAudit.list({ page: 1, limit: 1 });
		expect(result.items).toHaveLength(1);
		expect(result.items[0]?.id).toBe(newer.id);
		expect(result.items[0]?.id).not.toBe(older.id);
		expect(result.pagination).toEqual({
			page: 1,
			limit: 1,
			total: 2,
			totalPages: 2,
		});
	});

	it("applies adminId, entityType, action, entityId and date filters", async () => {
		const adminA = await createTestUser(testDb.client, {
			email: "admin-audit-router-filter-a@example.com",
			role: "admin",
		});
		const adminB = await createTestUser(testDb.client, {
			email: "admin-audit-router-filter-b@example.com",
			role: "admin",
		});
		const caller = createCaller(
			makeAuthenticatedContext(adminA.id, "admin", { db: testDb.db })
		);
		const target = await createAuditLogFixture({
			testDb,
			adminId: adminA.id,
			entityId: "44444444-4444-4444-8444-444444444444",
			entityType: "FILE",
			action: "DELETE",
			createdAt: new Date("2025-02-15T10:00:00.000Z"),
		});
		await createAuditLogFixture({
			testDb,
			adminId: adminB.id,
			entityId: "55555555-5555-4555-8555-555555555555",
			entityType: "CONTENT",
			action: "CREATE",
			createdAt: new Date("2025-02-20T10:00:00.000Z"),
		});

		const byAdmin = await caller.adminAudit.list({ adminId: adminA.id });
		expect(byAdmin.items).toHaveLength(1);
		expect(byAdmin.items[0]?.id).toBe(target.id);

		const byEntityType = await caller.adminAudit.list({ entityType: "FILE" });
		expect(byEntityType.items).toHaveLength(1);
		expect(byEntityType.items[0]?.id).toBe(target.id);

		const byAction = await caller.adminAudit.list({ action: "DELETE" });
		expect(byAction.items).toHaveLength(1);
		expect(byAction.items[0]?.id).toBe(target.id);

		const byEntityId = await caller.adminAudit.list({
			entityId: "44444444-4444-4444-8444-444444444444",
		});
		expect(byEntityId.items).toHaveLength(1);
		expect(byEntityId.items[0]?.id).toBe(target.id);

		const byDateRange = await caller.adminAudit.list({
			from: new Date("2025-02-15T00:00:00.000Z"),
			to: new Date("2025-02-15T23:59:59.999Z"),
		});
		expect(byDateRange.items).toHaveLength(1);
		expect(byDateRange.items[0]?.id).toBe(target.id);
	});

	it("returns empty list with valid pagination for no matches", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "admin-audit-router-empty@example.com",
			role: "admin",
		});
		const caller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);

		const result = await caller.adminAudit.list({
			entityType: "PLAYLIST",
			page: 1,
			limit: 20,
		});

		expect(result.items).toEqual([]);
		expect(result.pagination).toEqual({
			page: 1,
			limit: 20,
			total: 0,
			totalPages: 0,
		});
	});

	it("rejects invalid input", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "admin-audit-router-invalid@example.com",
			role: "admin",
		});
		const caller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);

		await expect(
			caller.adminAudit.list({
				entityId: "not-a-uuid",
			})
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));

		await expect(
			caller.adminAudit.list({
				page: 0,
			})
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));

		await expect(
			caller.adminAudit.list({
				from: new Date("2025-02-20T00:00:00.000Z"),
				to: new Date("2025-02-15T00:00:00.000Z"),
			})
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
	});
});
