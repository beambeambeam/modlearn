import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestUser } from "@/__tests__/helpers/factories";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "@/__tests__/helpers/test-db";
import { eq } from "@/lib/db/orm";
import { content, contentCategory } from "@/lib/db/schema";
import {
	createCategory,
	deleteCategory,
	getCategoryById,
	listCategories,
	updateCategory,
} from "@/modules/category/category.service";
import {
	CategoryNotFoundError,
	CategorySlugConflictError,
} from "@/modules/category/category.types";

describe("category service", () => {
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

	it("createCategory normalizes slug", async () => {
		const created = await createCategory({
			db: testDb.db,
			input: {
				title: "Data Science",
				slug: "  Data Science_Basics ",
			},
		});

		expect(created.slug).toBe("data-science-basics");
	});

	it("createCategory throws conflict on duplicate normalized slug", async () => {
		await createCategory({
			db: testDb.db,
			input: {
				title: "A",
				slug: "My Slug",
			},
		});

		await expect(
			createCategory({
				db: testDb.db,
				input: {
					title: "B",
					slug: "my_slug",
				},
			})
		).rejects.toThrow(CategorySlugConflictError);
	});

	it("listCategories supports search + pagination ordered by title then id", async () => {
		await createCategory({
			db: testDb.db,
			input: { title: "Alpha", slug: "alpha" },
		});
		await createCategory({
			db: testDb.db,
			input: { title: "Beta", slug: "beta" },
		});
		await createCategory({
			db: testDb.db,
			input: { title: "Gamma", slug: "gamma" },
		});

		const pageOne = await listCategories({
			db: testDb.db,
			input: {
				page: 1,
				limit: 2,
			},
		});
		expect(pageOne.items).toHaveLength(2);
		expect(pageOne.items[0]?.title).toBe("Alpha");
		expect(pageOne.pagination).toEqual({
			page: 1,
			limit: 2,
			total: 3,
			totalPages: 2,
		});

		const searched = await listCategories({
			db: testDb.db,
			input: {
				search: "ga",
			},
		});
		expect(searched.items).toHaveLength(1);
		expect(searched.items[0]?.title).toBe("Gamma");
	});

	it("getCategoryById returns row and throws when missing", async () => {
		const created = await createCategory({
			db: testDb.db,
			input: {
				title: "Language",
				slug: "language",
			},
		});

		const found = await getCategoryById({
			db: testDb.db,
			input: { id: created.id },
		});
		expect(found.id).toBe(created.id);

		await expect(
			getCategoryById({
				db: testDb.db,
				input: { id: "00000000-0000-0000-0000-000000000000" },
			})
		).rejects.toThrow(CategoryNotFoundError);
	});

	it("updateCategory patches fields and throws on slug conflict", async () => {
		const first = await createCategory({
			db: testDb.db,
			input: {
				title: "First",
				slug: "first",
			},
		});
		await createCategory({
			db: testDb.db,
			input: {
				title: "Second",
				slug: "second",
			},
		});

		const updated = await updateCategory({
			db: testDb.db,
			input: {
				id: first.id,
				patch: {
					title: "First Updated",
				},
			},
		});
		expect(updated.title).toBe("First Updated");
		expect(updated.slug).toBe("first");

		await expect(
			updateCategory({
				db: testDb.db,
				input: {
					id: first.id,
					patch: { slug: " second " },
				},
			})
		).rejects.toThrow(CategorySlugConflictError);
	});

	it("deleteCategory removes row and throws when missing", async () => {
		const created = await createCategory({
			db: testDb.db,
			input: {
				title: "Delete Me",
				slug: "delete-me",
			},
		});

		const deleted = await deleteCategory({
			db: testDb.db,
			input: { id: created.id },
		});
		expect(deleted).toEqual({
			id: created.id,
			deleted: true,
		});

		await expect(
			deleteCategory({
				db: testDb.db,
				input: { id: created.id },
			})
		).rejects.toThrow(CategoryNotFoundError);
	});

	it("deleteCategory cascades content_category links", async () => {
		const user = await createTestUser(testDb.client, {
			email: "category-cascade@example.com",
		});
		const createdCategory = await createCategory({
			db: testDb.db,
			input: { title: "Cascade", slug: "cascade" },
		});
		const [createdContent] = await testDb.db
			.insert(content)
			.values({
				title: "Linked Content",
				contentType: "MOVIE",
				updatedBy: user.id,
				isPublished: true,
				isAvailable: true,
				publishedAt: new Date("2025-01-01T00:00:00.000Z"),
			})
			.returning();
		if (!createdContent) {
			throw new Error("Failed to create content");
		}

		await testDb.db.insert(contentCategory).values({
			contentId: createdContent.id,
			categoryId: createdCategory.id,
		});

		await deleteCategory({
			db: testDb.db,
			input: { id: createdCategory.id },
		});

		const links = await testDb.db
			.select()
			.from(contentCategory)
			.where(eq(contentCategory.contentId, createdContent.id));
		expect(links).toHaveLength(0);
	});
});
