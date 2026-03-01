import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestUser } from "@/__tests__/helpers/factories";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "@/__tests__/helpers/test-db";
import { eq } from "@/lib/db/orm";
import { content } from "@/lib/db/schema";
import {
	createContent,
	getContentById,
	listContent,
	listPopularContent,
	setContentPublishState,
	updateContent,
} from "@/modules/content/content.service";
import { ContentNotFoundError } from "../content.types";

describe("content service", () => {
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

	it("listContent returns empty result with pagination when no data", async () => {
		const result = await listContent({
			db: testDb.db,
			input: {},
		});

		expect(result.items).toEqual([]);
		expect(result.pagination).toEqual({
			page: 1,
			limit: 20,
			total: 0,
			totalPages: 0,
		});
	});

	it("listContent returns only published and available content by default", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "admin-list-default@example.com",
		});

		await testDb.db.insert(content).values([
			{
				title: "Published Available",
				contentType: "MOVIE",
				updatedBy: admin.id,
				isPublished: true,
				isAvailable: true,
				publishedAt: new Date("2025-01-01T00:00:00.000Z"),
			},
			{
				title: "Unpublished",
				contentType: "MOVIE",
				updatedBy: admin.id,
				isPublished: false,
				isAvailable: true,
			},
			{
				title: "Unavailable",
				contentType: "MOVIE",
				updatedBy: admin.id,
				isPublished: true,
				isAvailable: false,
				publishedAt: new Date("2025-01-02T00:00:00.000Z"),
			},
		]);

		const result = await listContent({
			db: testDb.db,
			input: {},
		});

		expect(result.items).toHaveLength(1);
		expect(result.items[0]?.title).toBe("Published Available");
	});

	it("listContent supports search and contentType filters", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "admin-list-filter@example.com",
		});

		await testDb.db.insert(content).values([
			{
				title: "TypeScript Basics",
				contentType: "MOVIE",
				updatedBy: admin.id,
				isPublished: true,
				isAvailable: true,
				publishedAt: new Date("2025-01-01T00:00:00.000Z"),
			},
			{
				title: "TypeScript Series",
				contentType: "SERIES",
				updatedBy: admin.id,
				isPublished: true,
				isAvailable: true,
				publishedAt: new Date("2025-01-02T00:00:00.000Z"),
			},
		]);

		const result = await listContent({
			db: testDb.db,
			input: {
				search: "type",
				contentType: "SERIES",
			},
		});

		expect(result.items).toHaveLength(1);
		expect(result.items[0]?.title).toBe("TypeScript Series");
	});

	it("listContent paginates with deterministic ordering", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "admin-list-pagination@example.com",
		});

		await testDb.db.insert(content).values([
			{
				title: "Alpha",
				contentType: "MOVIE",
				updatedBy: admin.id,
				isPublished: true,
				isAvailable: true,
				createdAt: new Date("2025-01-01T00:00:00.000Z"),
				publishedAt: new Date("2025-01-01T00:00:00.000Z"),
			},
			{
				title: "Beta",
				contentType: "MOVIE",
				updatedBy: admin.id,
				isPublished: true,
				isAvailable: true,
				createdAt: new Date("2025-01-02T00:00:00.000Z"),
				publishedAt: new Date("2025-01-02T00:00:00.000Z"),
			},
			{
				title: "Gamma",
				contentType: "MOVIE",
				updatedBy: admin.id,
				isPublished: true,
				isAvailable: true,
				createdAt: new Date("2025-01-03T00:00:00.000Z"),
				publishedAt: new Date("2025-01-03T00:00:00.000Z"),
			},
		]);

		const pageTwo = await listContent({
			db: testDb.db,
			input: {
				page: 2,
				limit: 2,
				sortBy: "RECENTLY_ADDED",
			},
		});

		expect(pageTwo.items).toHaveLength(1);
		expect(pageTwo.items[0]?.title).toBe("Alpha");
		expect(pageTwo.pagination).toEqual({
			page: 2,
			limit: 2,
			total: 3,
			totalPages: 2,
		});
	});

	it("getContentById throws when content is not visible in public mode", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "admin-get-by-id@example.com",
		});

		const [created] = await testDb.db
			.insert(content)
			.values({
				title: "Draft Content",
				contentType: "MOVIE",
				updatedBy: admin.id,
				isPublished: false,
				isAvailable: true,
			})
			.returning();

		if (!created) {
			throw new Error("Failed to create content for test");
		}

		await expect(
			getContentById({
				db: testDb.db,
				input: {
					id: created.id,
				},
			})
		).rejects.toThrow(ContentNotFoundError);
	});

	it("listPopularContent sorts by views and then createdAt", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "admin-popular@example.com",
		});

		await testDb.db.insert(content).values([
			{
				title: "First",
				contentType: "MOVIE",
				updatedBy: admin.id,
				isPublished: true,
				isAvailable: true,
				viewCount: 5,
				createdAt: new Date("2025-01-01T00:00:00.000Z"),
				publishedAt: new Date("2025-01-01T00:00:00.000Z"),
			},
			{
				title: "Second",
				contentType: "MOVIE",
				updatedBy: admin.id,
				isPublished: true,
				isAvailable: true,
				viewCount: 5,
				createdAt: new Date("2025-01-02T00:00:00.000Z"),
				publishedAt: new Date("2025-01-02T00:00:00.000Z"),
			},
		]);

		const result = await listPopularContent({
			db: testDb.db,
			input: { limit: 10 },
		});

		expect(result[0]?.title).toBe("Second");
		expect(result[1]?.title).toBe("First");
	});

	it("createContent creates with defaults and updatedBy", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "admin-create@example.com",
		});

		const created = await createContent({
			db: testDb.db,
			input: {
				title: "New Content",
				contentType: "MOVIE",
			},
			updatedBy: admin.id,
		});

		expect(created.title).toBe("New Content");
		expect(created.updatedBy).toBe(admin.id);
		expect(created.isPublished).toBe(false);
	});

	it("updateContent updates only provided patch fields", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "admin-update@example.com",
		});

		const [created] = await testDb.db
			.insert(content)
			.values({
				title: "Original",
				description: "Original Description",
				contentType: "MOVIE",
				updatedBy: admin.id,
				isPublished: false,
				isAvailable: true,
			})
			.returning();

		if (!created) {
			throw new Error("Failed to create content for update test");
		}

		const updated = await updateContent({
			db: testDb.db,
			input: {
				id: created.id,
				patch: {
					title: "Updated",
				},
			},
			updatedBy: admin.id,
		});

		expect(updated.title).toBe("Updated");
		expect(updated.description).toBe("Original Description");
	});

	it("updateContent throws when id does not exist", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "admin-update-missing@example.com",
		});

		await expect(
			updateContent({
				db: testDb.db,
				input: {
					id: "00000000-0000-0000-0000-000000000000",
					patch: {
						title: "Nope",
					},
				},
				updatedBy: admin.id,
			})
		).rejects.toThrow(ContentNotFoundError);
	});

	it("setContentPublishState sets and clears publishedAt correctly", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "admin-publish@example.com",
		});

		const [created] = await testDb.db
			.insert(content)
			.values({
				title: "Publish Me",
				contentType: "MOVIE",
				updatedBy: admin.id,
				isPublished: false,
				isAvailable: true,
			})
			.returning();

		if (!created) {
			throw new Error("Failed to create content for publish test");
		}

		const published = await setContentPublishState({
			db: testDb.db,
			input: {
				id: created.id,
				isPublished: true,
			},
			updatedBy: admin.id,
		});
		expect(published.isPublished).toBe(true);
		expect(published.publishedAt).toBeInstanceOf(Date);

		const publishedAgain = await setContentPublishState({
			db: testDb.db,
			input: {
				id: created.id,
				isPublished: true,
			},
			updatedBy: admin.id,
		});
		expect(publishedAgain.publishedAt?.getTime()).toBe(
			published.publishedAt?.getTime()
		);

		const unpublished = await setContentPublishState({
			db: testDb.db,
			input: {
				id: created.id,
				isPublished: false,
			},
			updatedBy: admin.id,
		});
		expect(unpublished.isPublished).toBe(false);
		expect(unpublished.publishedAt).toBeNull();

		const [dbRow] = await testDb.db
			.select()
			.from(content)
			.where(eq(content.id, created.id));
		expect(dbRow?.publishedAt).toBeNull();
	});
});
