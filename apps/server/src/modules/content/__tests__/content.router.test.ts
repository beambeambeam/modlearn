import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestUser } from "@/__tests__/helpers/factories";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "@/__tests__/helpers/test-db";
import { adminAuditLog, category, content, genre } from "@/lib/db/schema";
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

		const context = makeTestContext({ db: testDb.db });
		const caller = createCaller(context);

		const listResult = await caller.content.list({});
		expect(listResult.items).toHaveLength(1);

		const detailResult = await caller.content.getById({ id: created.id });
		expect(detailResult.id).toBe(created.id);
		expect(detailResult.categories).toEqual([]);
		expect(detailResult.genres).toEqual([]);

		const popularResult = await caller.content.listPopular({});
		expect(popularResult).toHaveLength(1);
	});

	it("rejects invalid list/getById input", async () => {
		const context = makeTestContext({ db: testDb.db });
		const caller = createCaller(context);

		await expect(
			caller.content.list({
				page: 0,
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: "BAD_REQUEST",
			})
		);

		await expect(
			caller.content.list({
				limit: 51,
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: "BAD_REQUEST",
			})
		);

		await expect(
			caller.content.getById({
				id: "not-a-uuid",
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: "BAD_REQUEST",
			})
		);

		await expect(
			caller.content.list({
				categoryIds: [
					"00000000-0000-0000-0000-000000000001",
					"00000000-0000-0000-0000-000000000001",
				],
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: "BAD_REQUEST",
			})
		);
	});

	it("rejects admin mutations for unauthenticated users", async () => {
		const context = makeTestContext({ db: testDb.db });
		const caller = createCaller(context);

		await expect(
			caller.content.adminCreate({
				title: "No Session",
				contentType: "MOVIE",
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: "UNAUTHORIZED",
			})
		);
	});

	it("rejects admin mutations for non-admin users", async () => {
		const user = await createTestUser(testDb.client, {
			email: "router-user@example.com",
			role: "user",
		});
		const context = makeAuthenticatedContext(user.id, "user", {
			db: testDb.db,
		});
		const caller = createCaller(context);

		await expect(
			caller.content.adminCreate({
				title: "No Admin",
				contentType: "MOVIE",
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: "FORBIDDEN",
			})
		);
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

		const adminCtx = makeAuthenticatedContext(admin.id, "admin", {
			db: testDb.db,
		});
		const superadminCtx = makeAuthenticatedContext(
			superadmin.id,
			"superadmin",
			{
				db: testDb.db,
			}
		);

		const adminCaller = createCaller(adminCtx);
		const superadminCaller = createCaller(superadminCtx);

		const created = await adminCaller.content.adminCreate({
			title: "Admin Created",
			contentType: "MOVIE",
		});
		expect(created.title).toBe("Admin Created");
		expect(created.isPublished).toBe(false);

		const updated = await adminCaller.content.adminUpdate({
			id: created.id,
			patch: {
				description: "Updated by admin",
			},
		});
		expect(updated.description).toBe("Updated by admin");

		const published = await superadminCaller.content.adminSetPublishState({
			id: created.id,
			isPublished: true,
		});
		expect(published.isPublished).toBe(true);
		expect(published.publishedAt).toBeInstanceOf(Date);

		const [createdCategory] = await testDb.db
			.insert(category)
			.values({
				title: "Router Category",
				slug: "router-category",
			})
			.returning();
		const [createdGenre] = await testDb.db
			.insert(genre)
			.values({
				title: "Router Genre",
				slug: "router-genre",
			})
			.returning();

		if (!(createdCategory && createdGenre)) {
			throw new Error("Failed to create classification fixtures");
		}

		const classification = await adminCaller.content.adminSetClassification({
			id: created.id,
			categoryIds: [createdCategory.id],
			genreIds: [createdGenre.id],
		});
		expect(
			classification.categories.map((row: { id: string }) => row.id)
		).toEqual([createdCategory.id]);
		expect(classification.genres.map((row: { id: string }) => row.id)).toEqual([
			createdGenre.id,
		]);

		await expect(
			adminCaller.content.adminSetClassification({
				id: created.id,
				categoryIds: [createdCategory.id, createdCategory.id],
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: "BAD_REQUEST",
			})
		);

		await expect(
			adminCaller.content.adminSetClassification({
				id: created.id,
				categoryIds: ["00000000-0000-0000-0000-000000000000"],
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: "NOT_FOUND",
			})
		);

		const setUnavailable = await adminCaller.content.adminSetAvailability({
			id: created.id,
			isAvailable: false,
		});
		expect(setUnavailable.isAvailable).toBe(false);

		const auditRows = await testDb.db.select().from(adminAuditLog);
		const availabilityAudit = auditRows.find(
			(row) =>
				row.entityType === "CONTENT" &&
				row.action === "SET_AVAILABILITY" &&
				row.entityId === created.id &&
				row.adminId === admin.id
		);
		expect(availabilityAudit).toBeDefined();
		expect(availabilityAudit?.metadata).toEqual({
			isAvailable: false,
		});

		const deleted = await superadminCaller.content.adminDelete({
			id: created.id,
		});
		expect(deleted.id).toBe(created.id);
		expect(deleted.deleted).toBe(true);
		expect(deleted.deletedAt).toBeInstanceOf(Date);

		await expect(
			adminCaller.content.adminSetAvailability({
				id: created.id,
				isAvailable: true,
			})
		).rejects.toThrow(
			expect.objectContaining({
				code: "NOT_FOUND",
			})
		);
	});

	it("rejects adminDelete and adminSetAvailability for unauthorized users", async () => {
		const unauthenticatedCaller = createCaller(
			makeTestContext({ db: testDb.db })
		);

		await expect(
			unauthenticatedCaller.content.adminDelete({
				id: "00000000-0000-0000-0000-000000000000",
			})
		).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));

		await expect(
			unauthenticatedCaller.content.adminSetAvailability({
				id: "00000000-0000-0000-0000-000000000000",
				isAvailable: false,
			})
		).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));

		const user = await createTestUser(testDb.client, {
			email: "router-content-non-admin-delete@example.com",
			role: "user",
		});
		const userCaller = createCaller(
			makeAuthenticatedContext(user.id, "user", { db: testDb.db })
		);

		await expect(
			userCaller.content.adminDelete({
				id: "00000000-0000-0000-0000-000000000000",
			})
		).rejects.toThrow(expect.objectContaining({ code: "FORBIDDEN" }));

		await expect(
			userCaller.content.adminSetAvailability({
				id: "00000000-0000-0000-0000-000000000000",
				isAvailable: true,
			})
		).rejects.toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
	});
});
