import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestUser } from "@/__tests__/helpers/factories";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "@/__tests__/helpers/test-db";
import { eq } from "@/lib/db/orm";
import { content, contentGenre } from "@/lib/db/schema";
import {
	createGenre,
	deleteGenre,
	getGenreById,
	listGenres,
	updateGenre,
} from "@/modules/genre/genre.service";
import {
	GenreNotFoundError,
	GenreSlugConflictError,
} from "@/modules/genre/genre.types";

describe("genre service", () => {
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

	it("createGenre normalizes slug", async () => {
		const created = await createGenre({
			db: testDb.db,
			input: {
				title: "Action",
				slug: "  Action_Thriller ",
			},
		});

		expect(created.slug).toBe("action-thriller");
	});

	it("createGenre throws conflict on duplicate normalized slug", async () => {
		await createGenre({
			db: testDb.db,
			input: {
				title: "A",
				slug: "My Slug",
			},
		});

		await expect(
			createGenre({
				db: testDb.db,
				input: {
					title: "B",
					slug: "my_slug",
				},
			})
		).rejects.toThrow(GenreSlugConflictError);
	});

	it("listGenres supports search + pagination ordered by title then id", async () => {
		await createGenre({
			db: testDb.db,
			input: { title: "Action", slug: "action" },
		});
		await createGenre({
			db: testDb.db,
			input: { title: "Drama", slug: "drama" },
		});
		await createGenre({
			db: testDb.db,
			input: { title: "Fantasy", slug: "fantasy" },
		});

		const pageOne = await listGenres({
			db: testDb.db,
			input: {
				page: 1,
				limit: 2,
			},
		});
		expect(pageOne.items).toHaveLength(2);
		expect(pageOne.items[0]?.title).toBe("Action");
		expect(pageOne.pagination).toEqual({
			page: 1,
			limit: 2,
			total: 3,
			totalPages: 2,
		});

		const searched = await listGenres({
			db: testDb.db,
			input: {
				search: "fan",
			},
		});
		expect(searched.items).toHaveLength(1);
		expect(searched.items[0]?.title).toBe("Fantasy");
	});

	it("getGenreById returns row and throws when missing", async () => {
		const created = await createGenre({
			db: testDb.db,
			input: {
				title: "Mystery",
				slug: "mystery",
			},
		});

		const found = await getGenreById({
			db: testDb.db,
			input: { id: created.id },
		});
		expect(found.id).toBe(created.id);

		await expect(
			getGenreById({
				db: testDb.db,
				input: { id: "00000000-0000-0000-0000-000000000000" },
			})
		).rejects.toThrow(GenreNotFoundError);
	});

	it("updateGenre patches fields and throws on slug conflict", async () => {
		const first = await createGenre({
			db: testDb.db,
			input: {
				title: "First",
				slug: "first",
			},
		});
		await createGenre({
			db: testDb.db,
			input: {
				title: "Second",
				slug: "second",
			},
		});

		const updated = await updateGenre({
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
			updateGenre({
				db: testDb.db,
				input: {
					id: first.id,
					patch: { slug: " second " },
				},
			})
		).rejects.toThrow(GenreSlugConflictError);
	});

	it("deleteGenre removes row and throws when missing", async () => {
		const created = await createGenre({
			db: testDb.db,
			input: {
				title: "Delete Me",
				slug: "delete-me",
			},
		});

		const deleted = await deleteGenre({
			db: testDb.db,
			input: { id: created.id },
		});
		expect(deleted).toEqual({
			id: created.id,
			deleted: true,
		});

		await expect(
			deleteGenre({
				db: testDb.db,
				input: { id: created.id },
			})
		).rejects.toThrow(GenreNotFoundError);
	});

	it("deleteGenre cascades content_genre links", async () => {
		const user = await createTestUser(testDb.client, {
			email: "genre-cascade@example.com",
		});
		const createdGenre = await createGenre({
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

		await testDb.db.insert(contentGenre).values({
			contentId: createdContent.id,
			genreId: createdGenre.id,
		});

		await deleteGenre({
			db: testDb.db,
			input: { id: createdGenre.id },
		});

		const links = await testDb.db
			.select()
			.from(contentGenre)
			.where(eq(contentGenre.contentId, createdContent.id));
		expect(links).toHaveLength(0);
	});
});
