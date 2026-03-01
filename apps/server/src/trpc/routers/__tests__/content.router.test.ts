import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestUser } from "@/__tests__/helpers/factories";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "@/__tests__/helpers/test-db";
import { category, content, genre } from "@/lib/db/schema";
import {
	makeAuthenticatedContext,
	makeTestContext,
} from "@/trpc/__tests__/helpers";
import { appRouter } from "@/trpc/routers";

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

		const ctx = makeTestContext({ db: testDb.db });
		const caller = appRouter.createCaller(ctx);

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
		const ctx = makeTestContext({ db: testDb.db });
		const caller = appRouter.createCaller(ctx);

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
	});

	it("rejects admin mutations for unauthenticated users", async () => {
		const ctx = makeTestContext({ db: testDb.db });
		const caller = appRouter.createCaller(ctx);

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
		const ctx = makeAuthenticatedContext(user.id, "user", { db: testDb.db });
		const caller = appRouter.createCaller(ctx);

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

		const adminCaller = appRouter.createCaller(adminCtx);
		const superadminCaller = appRouter.createCaller(superadminCtx);

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
		expect(classification.categories.map((row) => row.id)).toEqual([
			createdCategory.id,
		]);
		expect(classification.genres.map((row) => row.id)).toEqual([
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
	});
});
