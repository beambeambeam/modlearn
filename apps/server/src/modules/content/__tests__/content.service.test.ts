import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestUser } from "@/__tests__/helpers/factories";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "@/__tests__/helpers/test-db";
import { category, content } from "@/lib/db/schema";
import {
	createContent,
	getContentById,
	listContent,
	setContentClassification,
} from "@/modules/content/content.service";
import {
	CategoryNotFoundError,
	ContentNotFoundError,
	InvalidClassificationInputError,
} from "../content.types";

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

	it("getContentById returns categories array", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "admin-get-by-id-with-classification@example.com",
		});
		const [created] = await testDb.db
			.insert(content)
			.values({
				title: "Classified Content",
				contentType: "MOVIE",
				updatedBy: admin.id,
				isPublished: true,
				isAvailable: true,
				publishedAt: new Date("2025-01-01T00:00:00.000Z"),
			})
			.returning();
		const [createdCategory] = await testDb.db
			.insert(category)
			.values({
				title: "Education",
				slug: "education",
			})
			.returning();

		if (!(created && createdCategory)) {
			throw new Error("Failed to create classification fixtures");
		}

		await setContentClassification({
			db: testDb.db,
			input: {
				id: created.id,
				categoryIds: [createdCategory.id],
			},
		});

		const result = await getContentById({
			db: testDb.db,
			input: {
				id: created.id,
			},
		});

		expect(result.categories.map((row) => row.id)).toEqual([
			createdCategory.id,
		]);
	});

	it("setContentClassification replaces categories and supports clearing", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "admin-classification-replace@example.com",
		});
		const [createdContent] = await testDb.db
			.insert(content)
			.values({
				title: "Replace Classification",
				contentType: "MOVIE",
				updatedBy: admin.id,
				isPublished: true,
				isAvailable: true,
				publishedAt: new Date("2025-01-01T00:00:00.000Z"),
			})
			.returning();
		const createdCategories = await testDb.db
			.insert(category)
			.values([
				{ title: "Cat A", slug: "cat-a" },
				{ title: "Cat B", slug: "cat-b" },
			])
			.returning();

		const contentId = createdContent?.id;
		const c1 = createdCategories[0]?.id;
		const c2 = createdCategories[1]?.id;
		if (!(contentId && c1 && c2)) {
			throw new Error("Failed to create classification fixtures");
		}

		const first = await setContentClassification({
			db: testDb.db,
			input: {
				id: contentId,
				categoryIds: [c1, c2],
			},
		});
		expect(first.categories.map((row) => row.id)).toEqual([c1, c2]);

		const second = await setContentClassification({
			db: testDb.db,
			input: {
				id: contentId,
				categoryIds: [],
			},
		});
		expect(second.categories).toHaveLength(0);
	});

	it("setContentClassification validates bad input and missing refs", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "admin-classification-validation@example.com",
		});
		const [createdContent] = await testDb.db
			.insert(content)
			.values({
				title: "Classification Validation",
				contentType: "MOVIE",
				updatedBy: admin.id,
				isPublished: true,
				isAvailable: true,
				publishedAt: new Date("2025-01-01T00:00:00.000Z"),
			})
			.returning();
		const [createdCategory] = await testDb.db
			.insert(category)
			.values({
				title: "Validation Category",
				slug: "validation-category",
			})
			.returning();

		const contentId = createdContent?.id;
		const categoryId = createdCategory?.id;
		if (!(contentId && categoryId)) {
			throw new Error("Failed to create classification fixtures");
		}

		await expect(
			Promise.resolve().then(() =>
				setContentClassification({
					db: testDb.db,
					input: {
						id: contentId,
						categoryIds: [categoryId, categoryId],
					},
				})
			)
		).rejects.toThrow(InvalidClassificationInputError);

		await expect(
			setContentClassification({
				db: testDb.db,
				input: {
					id: contentId,
					categoryIds: ["00000000-0000-0000-0000-000000000000"],
				},
			})
		).rejects.toThrow(CategoryNotFoundError);
	});

	it("listContent supports category filter", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "admin-list-classification-filters@example.com",
		});

		const [catA, catB] = await testDb.db
			.insert(category)
			.values([
				{ title: "Cat A", slug: "filter-cat-a" },
				{ title: "Cat B", slug: "filter-cat-b" },
			])
			.returning();

		if (!(catA && catB)) {
			throw new Error("Failed to create category fixtures");
		}

		const [contentOne, contentTwo, contentThree] = await testDb.db
			.insert(content)
			.values([
				{
					title: "Content One",
					contentType: "MOVIE",
					updatedBy: admin.id,
					isPublished: true,
					isAvailable: true,
					publishedAt: new Date("2025-01-01T00:00:00.000Z"),
				},
				{
					title: "Content Two",
					contentType: "MOVIE",
					updatedBy: admin.id,
					isPublished: true,
					isAvailable: true,
					publishedAt: new Date("2025-01-02T00:00:00.000Z"),
				},
				{
					title: "Content Three",
					contentType: "MOVIE",
					updatedBy: admin.id,
					isPublished: true,
					isAvailable: true,
					publishedAt: new Date("2025-01-03T00:00:00.000Z"),
				},
			])
			.returning();

		if (!(contentOne && contentTwo && contentThree)) {
			throw new Error("Failed to create content filter records");
		}

		await setContentClassification({
			db: testDb.db,
			input: {
				id: contentOne.id,
				categoryIds: [catA.id],
			},
		});
		await setContentClassification({
			db: testDb.db,
			input: {
				id: contentTwo.id,
				categoryIds: [catB.id],
			},
		});
		await setContentClassification({
			db: testDb.db,
			input: {
				id: contentThree.id,
				categoryIds: [catA.id],
			},
		});

		const categoryOnly = await listContent({
			db: testDb.db,
			input: {
				categoryIds: [catA.id],
			},
		});
		expect(categoryOnly.items.map((row) => row.id).sort()).toEqual(
			[contentOne.id, contentThree.id].sort()
		);
	});

	it("getContentById throws when content is not visible in public mode", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "admin-get-by-id@example.com",
		});

		const created = await createContent({
			db: testDb.db,
			input: {
				title: "Draft Content",
				contentType: "MOVIE",
			},
			updatedBy: admin.id,
		});

		await expect(
			getContentById({
				db: testDb.db,
				input: {
					id: created.id,
				},
			})
		).rejects.toThrow(ContentNotFoundError);
	});
});
