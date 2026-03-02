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

describe("category router", () => {
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

	it("allows public list/get", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "category-router-admin@example.com",
			role: "admin",
		});
		const caller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);
		const created = await caller.category.adminCreate({
			title: "Math",
			slug: "math",
		});

		const auditRows = await testDb.db.select().from(adminAuditLog);
		const createAudit = auditRows.find(
			(row) =>
				row.entityType === "CATEGORY" &&
				row.action === "CREATE" &&
				row.entityId === created.id &&
				row.adminId === admin.id
		);
		expect(createAudit).toBeDefined();

		const publicCaller = createCaller(makeTestContext({ db: testDb.db }));
		const listed = await publicCaller.category.list({});
		expect(listed.items).toHaveLength(1);
		const found = await publicCaller.category.getById({ id: created.id });
		expect(found.id).toBe(created.id);
	});

	it("rejects invalid input", async () => {
		const publicCaller = createCaller(makeTestContext({ db: testDb.db }));

		await expect(
			publicCaller.category.getById({
				id: "invalid",
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: "BAD_REQUEST",
			})
		);

		await expect(
			publicCaller.category.list({
				page: 0,
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: "BAD_REQUEST",
			})
		);
	});

	it("enforces admin auth", async () => {
		const publicCaller = createCaller(makeTestContext({ db: testDb.db }));
		await expect(
			publicCaller.category.adminCreate({
				title: "No Auth",
				slug: "no-auth",
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: "UNAUTHORIZED",
			})
		);

		const user = await createTestUser(testDb.client, {
			email: "category-router-user@example.com",
			role: "user",
		});
		const userCaller = createCaller(
			makeAuthenticatedContext(user.id, "user", { db: testDb.db })
		);
		await expect(
			userCaller.category.adminCreate({
				title: "No Admin",
				slug: "no-admin",
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: "FORBIDDEN",
			})
		);
	});

	it("maps conflict/not-found errors and allows admin updates/deletes", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "category-router-admin-2@example.com",
			role: "admin",
		});
		const superadmin = await createTestUser(testDb.client, {
			email: "category-router-superadmin@example.com",
			role: "superadmin",
		});

		const adminCaller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);
		const superadminCaller = createCaller(
			makeAuthenticatedContext(superadmin.id, "superadmin", { db: testDb.db })
		);

		const c1 = await adminCaller.category.adminCreate({
			title: "C1",
			slug: "same",
		});
		await adminCaller.category.adminCreate({
			title: "C2",
			slug: "other",
		});

		await expect(
			adminCaller.category.adminUpdate({
				id: c1.id,
				patch: { slug: "other" },
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: "CONFLICT",
			})
		);

		await expect(
			adminCaller.category.adminDelete({
				id: "00000000-0000-0000-0000-000000000000",
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: "NOT_FOUND",
			})
		);

		const updated = await superadminCaller.category.adminUpdate({
			id: c1.id,
			patch: { title: "Updated" },
		});
		expect(updated.title).toBe("Updated");

		const deleted = await superadminCaller.category.adminDelete({
			id: c1.id,
		});
		expect(deleted.deleted).toBe(true);
	});

	it("fails mutation when audit logging fails after business mutation", async () => {
		const caller = createCaller(
			makeAuthenticatedContext("missing-admin-user-id", "admin", {
				db: testDb.db,
			})
		);

		await expect(
			caller.category.adminCreate({
				title: "Audit Fail Category",
				slug: "audit-fail-category",
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to write admin audit log",
			})
		);

		const publicCaller = createCaller(makeTestContext({ db: testDb.db }));
		const listed = await publicCaller.category.list({});
		expect(
			listed.items.map((row: { slug: string | null }) => row.slug ?? "")
		).toContain("audit-fail-category");
	});
});
