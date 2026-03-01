import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestUser } from "@/__tests__/helpers/factories";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "@/__tests__/helpers/test-db";
import { eq } from "@/lib/db/orm";
import { category, content, genre } from "@/lib/db/schema";
import {
	createContent,
	deleteContent,
	getContentById,
	listContent,
	listPopularContent,
	setContentAvailability,
	setContentClassification,
	setContentPublishState,
	updateContent,
} from "@/modules/content/content.service";
import {
	CategoryNotFoundError,
	ContentNotFoundError,
	GenreNotFoundError,
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

	it("getContentById returns categories and genres arrays", async () => {
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
		const [createdGenre] = await testDb.db
			.insert(genre)
			.values({
				title: "Documentary",
				slug: "documentary",
			})
			.returning();

		if (!(created && createdCategory && createdGenre)) {
			throw new Error("Failed to create classification fixtures");
		}

		await setContentClassification({
			db: testDb.db,
			input: {
				id: created.id,
				categoryIds: [createdCategory.id],
				genreIds: [createdGenre.id],
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
		expect(result.genres.map((row) => row.id)).toEqual([createdGenre.id]);
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

	it("setContentClassification replaces and preserves dimensions", async () => {
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
		const createdGenres = await testDb.db
			.insert(genre)
			.values([
				{ title: "Genre A", slug: "genre-a" },
				{ title: "Genre B", slug: "genre-b" },
			])
			.returning();

		const contentId = createdContent?.id;
		const c1 = createdCategories[0]?.id;
		const c2 = createdCategories[1]?.id;
		const g1 = createdGenres[0]?.id;
		const g2 = createdGenres[1]?.id;
		if (!(contentId && c1 && c2 && g1 && g2)) {
			throw new Error("Failed to create classification fixtures");
		}

		const first = await setContentClassification({
			db: testDb.db,
			input: {
				id: contentId,
				categoryIds: [c1, c2],
				genreIds: [g1],
			},
		});
		expect(first.categories.map((row) => row.id)).toEqual([c1, c2]);
		expect(first.genres.map((row) => row.id)).toEqual([g1]);

		const second = await setContentClassification({
			db: testDb.db,
			input: {
				id: contentId,
				genreIds: [g2],
			},
		});
		expect(second.categories.map((row) => row.id)).toEqual([c1, c2]);
		expect(second.genres.map((row) => row.id)).toEqual([g2]);

		const third = await setContentClassification({
			db: testDb.db,
			input: {
				id: contentId,
				categoryIds: [],
			},
		});
		expect(third.categories).toHaveLength(0);
		expect(third.genres.map((row) => row.id)).toEqual([g2]);
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
					},
				})
			)
		).rejects.toThrow(InvalidClassificationInputError);

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

		await expect(
			setContentClassification({
				db: testDb.db,
				input: {
					id: contentId,
					genreIds: ["00000000-0000-0000-0000-000000000000"],
				},
			})
		).rejects.toThrow(GenreNotFoundError);
	});

	it("deleteContent marks row as deleted and hides it from reads", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "admin-delete-content@example.com",
		});

		const [created] = await testDb.db
			.insert(content)
			.values({
				title: "Delete Me",
				contentType: "MOVIE",
				updatedBy: admin.id,
				isPublished: true,
				isAvailable: true,
				publishedAt: new Date("2025-01-01T00:00:00.000Z"),
			})
			.returning();

		if (!created) {
			throw new Error("Failed to create content for delete test");
		}

		const deleted = await deleteContent({
			db: testDb.db,
			input: { id: created.id },
			updatedBy: admin.id,
		});

		expect(deleted.id).toBe(created.id);
		expect(deleted.deleted).toBe(true);
		expect(deleted.deletedAt).toBeInstanceOf(Date);

		await expect(
			getContentById({
				db: testDb.db,
				input: { id: created.id },
			})
		).rejects.toThrow(ContentNotFoundError);

		const listed = await listContent({
			db: testDb.db,
			input: {},
		});
		expect(listed.items.map((row) => row.id)).not.toContain(created.id);

		const popular = await listPopularContent({
			db: testDb.db,
			input: {},
		});
		expect(popular.map((row) => row.id)).not.toContain(created.id);
	});

	it("setContentAvailability updates availability and rejects deleted content", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "admin-set-availability@example.com",
		});

		const [created] = await testDb.db
			.insert(content)
			.values({
				title: "Toggle Availability",
				contentType: "MOVIE",
				updatedBy: admin.id,
				isPublished: true,
				isAvailable: true,
				publishedAt: new Date("2025-01-01T00:00:00.000Z"),
			})
			.returning();

		if (!created) {
			throw new Error("Failed to create content for availability test");
		}

		const unavailable = await setContentAvailability({
			db: testDb.db,
			input: { id: created.id, isAvailable: false },
			updatedBy: admin.id,
		});
		expect(unavailable.isAvailable).toBe(false);

		await deleteContent({
			db: testDb.db,
			input: { id: created.id },
			updatedBy: admin.id,
		});

		await expect(
			setContentAvailability({
				db: testDb.db,
				input: { id: created.id, isAvailable: true },
				updatedBy: admin.id,
			})
		).rejects.toThrow(ContentNotFoundError);
	});

	it("operations reject deleted content as not found", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "admin-deleted-guard@example.com",
		});

		const [created] = await testDb.db
			.insert(content)
			.values({
				title: "Deleted Guard",
				contentType: "MOVIE",
				updatedBy: admin.id,
				isPublished: false,
				isAvailable: true,
			})
			.returning();
		const [createdCategory] = await testDb.db
			.insert(category)
			.values({
				title: "Deleted Guard Category",
				slug: "deleted-guard-category",
			})
			.returning();

		if (!(created && createdCategory)) {
			throw new Error("Failed to create deleted guard fixtures");
		}

		await deleteContent({
			db: testDb.db,
			input: { id: created.id },
			updatedBy: admin.id,
		});

		await expect(
			updateContent({
				db: testDb.db,
				input: { id: created.id, patch: { title: "Nope" } },
				updatedBy: admin.id,
			})
		).rejects.toThrow(ContentNotFoundError);

		await expect(
			setContentPublishState({
				db: testDb.db,
				input: { id: created.id, isPublished: true },
				updatedBy: admin.id,
			})
		).rejects.toThrow(ContentNotFoundError);

		await expect(
			setContentClassification({
				db: testDb.db,
				input: { id: created.id, categoryIds: [createdCategory.id] },
			})
		).rejects.toThrow(ContentNotFoundError);
	});

	it("listContent supports category/genre filters with OR-in and AND-across", async () => {
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
		const [genreA, genreB] = await testDb.db
			.insert(genre)
			.values([
				{ title: "Genre A", slug: "filter-genre-a" },
				{ title: "Genre B", slug: "filter-genre-b" },
			])
			.returning();

		if (!(catA && catB && genreA && genreB)) {
			throw new Error("Failed to create classification filter fixtures");
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
				genreIds: [genreA.id],
			},
		});
		await setContentClassification({
			db: testDb.db,
			input: {
				id: contentTwo.id,
				categoryIds: [catB.id],
				genreIds: [genreB.id],
			},
		});
		await setContentClassification({
			db: testDb.db,
			input: {
				id: contentThree.id,
				categoryIds: [catA.id],
				genreIds: [genreB.id],
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

		const genreOnly = await listContent({
			db: testDb.db,
			input: {
				genreIds: [genreB.id],
			},
		});
		expect(genreOnly.items.map((row) => row.id).sort()).toEqual(
			[contentTwo.id, contentThree.id].sort()
		);

		const bothDimensions = await listContent({
			db: testDb.db,
			input: {
				categoryIds: [catA.id, catB.id],
				genreIds: [genreA.id],
			},
		});
		expect(bothDimensions.items.map((row) => row.id)).toEqual([contentOne.id]);

		const emptyFiltersIgnored = await listContent({
			db: testDb.db,
			input: {
				categoryIds: [],
				genreIds: [],
			},
		});
		expect(emptyFiltersIgnored.items).toHaveLength(3);
	});
});
