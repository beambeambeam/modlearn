import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestUser } from "@/__tests__/helpers/factories";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "@/__tests__/helpers/test-db";
import {
	content,
	contentPricing,
	playlist,
	playlistPricing,
	userLibrary,
} from "@/lib/db/schema";
import {
	createCaller,
	makeAuthenticatedContext,
	makeTestContext,
} from "@/orpc/__tests__/helpers";

async function createPricedContent(params: {
	testDb: TestDatabase;
	adminId: string;
	title: string;
	price: string;
	currency?: string;
}) {
	const { testDb, adminId, title, price, currency = "USD" } = params;
	const [created] = await testDb.db
		.insert(content)
		.values({
			title,
			contentType: "MOVIE",
			updatedBy: adminId,
		})
		.returning();

	if (!created) {
		throw new Error("Failed to create content");
	}

	await testDb.db.insert(contentPricing).values({
		contentId: created.id,
		price,
		currency,
		effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
		createdBy: adminId,
	});

	return created;
}

async function createPlaylistFixture(params: {
	testDb: TestDatabase;
	adminId: string;
	title: string;
}) {
	const { testDb, adminId, title } = params;
	const [created] = await testDb.db
		.insert(playlist)
		.values({
			creatorId: adminId,
			title,
		})
		.returning();
	if (!created) {
		throw new Error("Failed to create playlist");
	}
	return created;
}

describe("commerce router", () => {
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

	it("requires authentication for commerce procedures", async () => {
		const caller = createCaller(makeTestContext({ db: testDb.db }));

		await expect(
			caller.commerce.payment.markSuccess({
				orderId: "00000000-0000-0000-0000-000000000000",
				providerTransactionId: "unauthorized-check",
			})
		).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
	});

	it("validates input payloads", async () => {
		const user = await createTestUser(testDb.client, {
			email: "commerce-router-validate@example.com",
		});
		const caller = createCaller(
			makeAuthenticatedContext(user.id, "user", { db: testDb.db })
		);

		await expect(
			caller.commerce.purchase.buyContent({
				contentId: "not-uuid",
			})
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
	});

	it("supports direct purchase flow", async () => {
		const user = await createTestUser(testDb.client, {
			email: "commerce-router-user@example.com",
		});
		const movie = await createPricedContent({
			testDb,
			adminId: user.id,
			title: "Router Movie",
			price: "10.00",
		});

		const caller = createCaller(
			makeAuthenticatedContext(user.id, "user", { db: testDb.db })
		);

		const purchased = await caller.commerce.purchase.buyContent({
			contentId: movie.id,
		});
		expect(purchased.status).toBe("PAID");
		expect(purchased.alreadyOwned).toBe(false);
		expect(purchased.grantedContentCount).toBe(1);

		const libraryRows = await testDb.db
			.select()
			.from(userLibrary)
			.where(eq(userLibrary.userId, user.id));
		expect(libraryRows).toHaveLength(1);
	});

	it("maps domain errors to ORPC codes", async () => {
		const user = await createTestUser(testDb.client, {
			email: "commerce-router-errors@example.com",
		});
		const movie = await createPricedContent({
			testDb,
			adminId: user.id,
			title: "Router Duplicate",
			price: "14.00",
		});
		const caller = createCaller(
			makeAuthenticatedContext(user.id, "user", { db: testDb.db })
		);

		await caller.commerce.purchase.buyContent({
			contentId: movie.id,
		});

		const existing = await caller.commerce.purchase.buyContent({
			contentId: movie.id,
		});
		expect(existing.alreadyOwned).toBe(true);
		expect(existing.grantedContentCount).toBe(0);

		await expect(
			caller.commerce.payment.markSuccess({
				orderId: "00000000-0000-0000-0000-000000000000",
				provider: "mock",
				providerTransactionId: "missing-order-txn",
			})
		).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
	});

	it("enforces auth and admin role for admin pricing APIs", async () => {
		const noSessionCaller = createCaller(makeTestContext({ db: testDb.db }));
		await expect(
			noSessionCaller.commerce.adminPricing.content.list({
				contentId: "00000000-0000-0000-0000-000000000000",
			})
		).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));

		const user = await createTestUser(testDb.client, {
			email: "commerce-admin-pricing-user@example.com",
			role: "user",
		});
		const userCaller = createCaller(
			makeAuthenticatedContext(user.id, "user", { db: testDb.db })
		);
		await expect(
			userCaller.commerce.adminPricing.content.create({
				contentId: "00000000-0000-0000-0000-000000000000",
				price: "10.00",
				currency: "USD",
				effectiveFrom: new Date("2026-03-01T00:00:00.000Z"),
			})
		).rejects.toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
	});

	it("supports admin content pricing create/list/update and overlap rejection", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "commerce-admin-pricing-content@example.com",
			role: "admin",
		});
		const [createdContent] = await testDb.db
			.insert(content)
			.values({
				title: "Admin Content Pricing",
				contentType: "MOVIE",
				updatedBy: admin.id,
			})
			.returning();
		if (!createdContent) {
			throw new Error("Failed to create content fixture");
		}

		const caller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);
		const now = new Date();
		const from = new Date(now.getTime() - 60 * 60 * 1000);
		const to = new Date(now.getTime() + 60 * 60 * 1000);
		const laterTo = new Date(now.getTime() + 2 * 60 * 60 * 1000);

		const created = await caller.commerce.adminPricing.content.create({
			contentId: createdContent.id,
			price: "12.00",
			currency: "usd",
			effectiveFrom: from,
			effectiveTo: to,
		});
		expect(created.currency).toBe("USD");
		expect(typeof created.isActive).toBe("boolean");

		const listed = await caller.commerce.adminPricing.content.list({
			contentId: createdContent.id,
		});
		expect(listed.items).toHaveLength(1);
		expect(listed.items[0]?.id).toBe(created.id);

		const updated = await caller.commerce.adminPricing.content.update({
			id: created.id,
			patch: {
				currency: "thb",
				price: "13.50",
			},
		});
		expect(updated.currency).toBe("THB");
		expect(updated.price).toBe("13.50");

		await caller.commerce.adminPricing.content.create({
			contentId: createdContent.id,
			price: "15.00",
			currency: "USD",
			effectiveFrom: to,
			effectiveTo: laterTo,
		});

		await expect(
			caller.commerce.adminPricing.content.create({
				contentId: createdContent.id,
				price: "16.00",
				currency: "USD",
				effectiveFrom: new Date(now.getTime()),
				effectiveTo: laterTo,
			})
		).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
	});

	it("supports admin playlist pricing create/list/update and overlap rejection", async () => {
		const admin = await createTestUser(testDb.client, {
			email: "commerce-admin-pricing-playlist@example.com",
			role: "admin",
		});
		const createdPlaylist = await createPlaylistFixture({
			testDb,
			adminId: admin.id,
			title: "Admin Playlist Pricing",
		});
		const caller = createCaller(
			makeAuthenticatedContext(admin.id, "admin", { db: testDb.db })
		);

		const created = await caller.commerce.adminPricing.playlist.create({
			playlistId: createdPlaylist.id,
			price: "35.00",
			currency: "usd",
			effectiveFrom: new Date("2026-03-01"),
			effectiveTo: new Date("2026-03-02"),
		});
		expect(created.currency).toBe("USD");
		expect(typeof created.isActive).toBe("boolean");

		const listed = await caller.commerce.adminPricing.playlist.list({
			playlistId: createdPlaylist.id,
		});
		expect(listed.items).toHaveLength(1);
		expect(listed.items[0]?.id).toBe(created.id);

		const updated = await caller.commerce.adminPricing.playlist.update({
			id: created.id,
			patch: {
				price: "39.00",
				currency: "thb",
			},
		});
		expect(updated.price).toBe("39.00");
		expect(updated.currency).toBe("THB");

		await caller.commerce.adminPricing.playlist.create({
			playlistId: createdPlaylist.id,
			price: "45.00",
			currency: "USD",
			effectiveFrom: new Date("2026-03-03"),
			effectiveTo: new Date("2026-03-04"),
		});

		await expect(
			caller.commerce.adminPricing.playlist.create({
				playlistId: createdPlaylist.id,
				price: "50.00",
				currency: "USD",
				effectiveFrom: new Date("2026-03-02"),
				effectiveTo: new Date("2026-03-05"),
			})
		).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));

		const rows = await testDb.db
			.select()
			.from(playlistPricing)
			.where(eq(playlistPricing.playlistId, createdPlaylist.id));
		expect(rows.length).toBeGreaterThanOrEqual(2);
	});
});
