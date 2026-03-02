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

describe("genre router", () => {
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
			email: "genre-router-admin@example.com",
			role: "admin",
		});
		const caller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);
		const created = await caller.genre.adminCreate({
			title: "Action",
			slug: "action",
		});

		const publicCaller = createCaller(makeTestContext({ db: testDb.db }));
		const listed = await publicCaller.genre.list({});
		expect(listed.items).toHaveLength(1);
		const found = await publicCaller.genre.getById({ id: created.id });
		expect(found.id).toBe(created.id);
	});

	it("rejects invalid input", async () => {
		const publicCaller = createCaller(makeTestContext({ db: testDb.db }));

		await expect(
			publicCaller.genre.getById({
				id: "invalid",
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: "BAD_REQUEST",
			})
		);

		await expect(
			publicCaller.genre.list({
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
			publicCaller.genre.adminCreate({
				title: "No Auth",
				slug: "no-auth",
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: "UNAUTHORIZED",
			})
		);

		const user = await createTestUser(testDb.client, {
			email: "genre-router-user@example.com",
			role: "user",
		});
		const userCaller = createCaller(
			makeAuthenticatedContext(user.id, "user", { db: testDb.db })
		);
		await expect(
			userCaller.genre.adminCreate({
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
			email: "genre-router-admin-2@example.com",
			role: "admin",
		});
		const superadmin = await createTestUser(testDb.client, {
			email: "genre-router-superadmin@example.com",
			role: "superadmin",
		});

		const adminCaller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);
		const superadminCaller = createCaller(
			makeAuthenticatedContext(superadmin.id, "superadmin", { db: testDb.db })
		);

		const g1 = await adminCaller.genre.adminCreate({
			title: "G1",
			slug: "same",
		});
		await adminCaller.genre.adminCreate({
			title: "G2",
			slug: "other",
		});

		await expect(
			adminCaller.genre.adminUpdate({
				id: g1.id,
				patch: { slug: "other" },
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: "CONFLICT",
			})
		);

		await expect(
			adminCaller.genre.adminDelete({
				id: "00000000-0000-0000-0000-000000000000",
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: "NOT_FOUND",
			})
		);

		const updated = await superadminCaller.genre.adminUpdate({
			id: g1.id,
			patch: { title: "Updated" },
		});
		expect(updated.title).toBe("Updated");

		const deleted = await superadminCaller.genre.adminDelete({
			id: g1.id,
		});
		expect(deleted.deleted).toBe(true);

		const auditRows = await testDb.db.select().from(adminAuditLog);
		const deleteAudit = auditRows.find(
			(row) =>
				row.entityType === "GENRE" &&
				row.action === "DELETE" &&
				row.entityId === g1.id &&
				row.adminId === superadmin.id
		);
		expect(deleteAudit).toBeDefined();
	});
});
