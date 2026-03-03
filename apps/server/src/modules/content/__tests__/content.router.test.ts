import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestUser } from "@/__tests__/helpers/factories";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "@/__tests__/helpers/test-db";
import { adminAuditLog, category, content } from "@/lib/db/schema";
import {
	createCaller,
	makeAuthenticatedContext,
	makeTestContext,
} from "@/orpc/__tests__/helpers";

describe("content router", () => {
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

	it("allows public access to list/getById/listPopular", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "router-public-admin@example.com",
			role: "admin",
		});

		const [created] = await testDb.db
			.insert(content)
			.values({
				title: "Public Content",
				contentType: "MOVIE",
				updatedBy: admin.id,
				isPublished: true,
				isAvailable: true,
				publishedAt: new Date("2025-01-01T00:00:00.000Z"),
			})
			.returning();

		if (!created) {
			throw new Error("Failed to create content for public router test");
		}

		const caller = createCaller(makeTestContext({ db: testDb.db }));

		const listResult = await caller.content.list({});
		expect(listResult.items).toHaveLength(1);

		const detailResult = await caller.content.getById({ id: created.id });
		expect(detailResult.id).toBe(created.id);
		expect(detailResult.categories).toEqual([]);
		expect("genres" in detailResult).toBe(false);

		const popularResult = await caller.content.listPopular({});
		expect(popularResult).toHaveLength(1);
	});

	it("rejects invalid list/getById input", async () => {
		const caller = createCaller(makeTestContext({ db: testDb.db }));

		await expect(caller.content.list({ page: 0 })).rejects.toThrow(
			expect.objectContaining({ code: "BAD_REQUEST" })
		);

		await expect(caller.content.list({ limit: 51 })).rejects.toThrow(
			expect.objectContaining({ code: "BAD_REQUEST" })
		);

		await expect(caller.content.getById({ id: "not-a-uuid" })).rejects.toThrow(
			expect.objectContaining({ code: "BAD_REQUEST" })
		);

		await expect(
			caller.content.list({
				categoryIds: [
					"00000000-0000-0000-0000-000000000001",
					"00000000-0000-0000-0000-000000000001",
				],
			})
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
	});

	it("allows admin and superadmin to run admin mutations", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "router-admin@example.com",
			role: "admin",
		});
		const superadmin = await createTestUser(testDb.client, {
			email: "router-superadmin@example.com",
			role: "superadmin",
		});

		const adminCaller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);
		const superadminCaller = createCaller(
			makeAuthenticatedContext(superadmin.id, "superadmin", { db: testDb.db })
		);

		const created = await adminCaller.content.adminCreate({
			title: "Admin Created",
			contentType: "MOVIE",
		});
		expect(created.isPublished).toBe(false);

		const [createdCategory] = await testDb.db
			.insert(category)
			.values({ title: "Router Category", slug: "router-category" })
			.returning();

		if (!createdCategory) {
			throw new Error("Failed to create category fixture");
		}

		const classification = await adminCaller.content.adminSetClassification({
			id: created.id,
			categoryIds: [createdCategory.id],
		});
		expect(classification.categories.map((row) => row.id)).toEqual([
			createdCategory.id,
		]);
		expect("genres" in classification).toBe(false);

		await expect(
			adminCaller.content.adminSetClassification({
				id: created.id,
				categoryIds: [createdCategory.id, createdCategory.id],
			})
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));

		const setUnavailable = await adminCaller.content.adminSetAvailability({
			id: created.id,
			isAvailable: false,
		});
		expect(setUnavailable.isAvailable).toBe(false);

		const auditRows = await testDb.db.select().from(adminAuditLog);
		const classificationAudit = auditRows.find(
			(row) =>
				row.entityType === "CONTENT" &&
				row.action === "SET_CLASSIFICATION" &&
				row.entityId === created.id
		);
		expect(classificationAudit).toBeDefined();
		expect(classificationAudit?.metadata).toEqual({
			categoryIds: [createdCategory.id],
		});

		const deleted = await superadminCaller.content.adminDelete({
			id: created.id,
		});
		expect(deleted.deleted).toBe(true);
	});
});
