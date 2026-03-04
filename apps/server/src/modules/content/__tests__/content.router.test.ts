import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestUser } from "@/__tests__/helpers/factories";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "@/__tests__/helpers/test-db";
import {
	adminAuditLog,
	category,
	content,
	contentPricing,
} from "@/lib/db/schema";
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

	it("allows public access to list/getById/listPopular with active pricing", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "router-public-admin@example.com",
			role: "admin",
		});

		const [pricedContent, noPriceContent] = await testDb.db
			.insert(content)
			.values([
				{
					title: "Public Content",
					contentType: "MOVIE",
					updatedBy: admin.id,
					isPublished: true,
					isAvailable: true,
					publishedAt: new Date("2025-01-01T00:00:00.000Z"),
					viewCount: 200,
				},
				{
					title: "No Price Content",
					contentType: "MOVIE",
					updatedBy: admin.id,
					isPublished: true,
					isAvailable: true,
					publishedAt: new Date("2025-01-01T00:00:00.000Z"),
				},
			])
			.returning();

		if (!(pricedContent && noPriceContent)) {
			throw new Error("Failed to create content for public router test");
		}

		await testDb.db.insert(contentPricing).values({
			contentId: pricedContent.id,
			price: "12.50",
			currency: "usd",
			effectiveFrom: new Date("2025-01-01T00:00:00.000Z"),
			createdBy: admin.id,
		});

		const caller = createCaller(makeTestContext({ db: testDb.db }));

		const listResult = await caller.content.list({});
		expect(listResult.items).toHaveLength(2);
		const pricedFromList = listResult.items.find(
			(item) => item.id === pricedContent.id
		);
		const noPriceFromList = listResult.items.find(
			(item) => item.id === noPriceContent.id
		);
		expect(pricedFromList?.activePricing).toEqual({
			price: "12.50",
			currency: "USD",
		});
		expect(noPriceFromList?.activePricing).toBeNull();

		const detailResult = await caller.content.getById({ id: pricedContent.id });
		expect(detailResult.id).toBe(pricedContent.id);
		expect(detailResult.categories).toEqual([]);
		expect("genres" in detailResult).toBe(false);
		expect(detailResult.activePricing).toEqual({
			price: "12.50",
			currency: "USD",
		});

		const noPriceDetailResult = await caller.content.getById({
			id: noPriceContent.id,
		});
		expect(noPriceDetailResult.activePricing).toBeNull();

		const popularResult = await caller.content.listPopular({});
		expect(popularResult).toHaveLength(2);
		expect(popularResult[0]?.id).toBe(pricedContent.id);
		expect(popularResult[0]?.activePricing).toEqual({
			price: "12.50",
			currency: "USD",
		});
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

	it("enforces published-only visibility on public endpoints", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "router-public-visibility-admin@example.com",
			role: "admin",
		});

		const [published, draft] = await testDb.db
			.insert(content)
			.values([
				{
					title: "Published Public",
					contentType: "MOVIE",
					updatedBy: admin.id,
					isPublished: true,
					isAvailable: true,
					publishedAt: new Date("2025-01-01T00:00:00.000Z"),
				},
				{
					title: "Draft Private",
					contentType: "MOVIE",
					updatedBy: admin.id,
					isPublished: false,
					isAvailable: true,
				},
			])
			.returning();

		if (!(published && draft)) {
			throw new Error("Failed to create public visibility fixtures");
		}

		const caller = createCaller(makeTestContext({ db: testDb.db }));
		const listResult = await caller.content.list({
			onlyPublished: false,
		} as unknown as Parameters<typeof caller.content.list>[0]);

		expect(listResult.items.map((row) => row.id)).toEqual([published.id]);
		await expect(
			caller.content.getById({
				id: draft.id,
				onlyPublished: false,
			} as unknown as Parameters<typeof caller.content.getById>[0])
		).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
	});

	it("allows admin read endpoints to preview unpublished content", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "router-admin-read-preview@example.com",
			role: "admin",
		});

		const [published, draft] = await testDb.db
			.insert(content)
			.values([
				{
					title: "Admin Published",
					contentType: "MOVIE",
					updatedBy: admin.id,
					isPublished: true,
					isAvailable: true,
					publishedAt: new Date("2025-01-01T00:00:00.000Z"),
				},
				{
					title: "Admin Draft",
					contentType: "MOVIE",
					updatedBy: admin.id,
					isPublished: false,
					isAvailable: true,
				},
			])
			.returning();

		if (!(published && draft)) {
			throw new Error("Failed to create admin read fixtures");
		}

		const adminCaller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);
		const adminListResult = await adminCaller.content.adminList({
			onlyPublished: false,
		});
		expect(adminListResult.items.map((row) => row.id).sort()).toEqual(
			[published.id, draft.id].sort()
		);

		const adminDetail = await adminCaller.content.adminGetById({
			id: draft.id,
			onlyPublished: false,
		});
		expect(adminDetail.id).toBe(draft.id);
	});

	it("rejects admin read endpoints for unauthenticated and non-admin users", async () => {
		const noSessionCaller = createCaller(makeTestContext({ db: testDb.db }));
		await expect(noSessionCaller.content.adminList({})).rejects.toThrow(
			expect.objectContaining({ code: "UNAUTHORIZED" })
		);

		const user = await createTestUser(testDb.client, {
			email: "router-content-read-user@example.com",
			role: "user",
		});
		const userCaller = createCaller(
			makeAuthenticatedContext(user.id, "user", { db: testDb.db })
		);
		await expect(
			userCaller.content.adminGetById({
				id: "00000000-0000-0000-0000-000000000000",
			})
		).rejects.toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
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
