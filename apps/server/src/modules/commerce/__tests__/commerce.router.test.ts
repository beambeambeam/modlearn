import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestUser } from "@/__tests__/helpers/factories";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "@/__tests__/helpers/test-db";
import { content, contentPricing, userLibrary } from "@/lib/db/schema";
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

		await expect(caller.commerce.cart.list({})).rejects.toThrow(
			expect.objectContaining({ code: "UNAUTHORIZED" })
		);
	});

	it("validates input payloads", async () => {
		const user = await createTestUser(testDb.client, {
			email: "commerce-router-validate@example.com",
		});
		const caller = createCaller(
			makeAuthenticatedContext(user.id, "user", { db: testDb.db })
		);

		await expect(
			caller.commerce.cart.addItem({
				itemType: "CONTENT",
				contentId: "not-uuid",
			})
		).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
	});

	it("supports cart + checkout + payment + purchase flow", async () => {
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

		const cartAfterAdd = await caller.commerce.cart.addItem({
			itemType: "CONTENT",
			contentId: movie.id,
		});
		expect(cartAfterAdd.items).toHaveLength(1);

		const checkout = await caller.commerce.checkout.createOrder({
			source: "CART",
		});
		expect(checkout.status).toBe("PENDING");

		const paid = await caller.commerce.payment.markSuccess({
			orderId: checkout.orderId,
			provider: "mock",
			providerTransactionId: "router-txn-001",
		});
		expect(paid.status).toBe("PAID");
		expect(paid.grantsCreated).toBe(1);

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

		await caller.commerce.cart.addItem({
			itemType: "CONTENT",
			contentId: movie.id,
		});

		await expect(
			caller.commerce.cart.addItem({
				itemType: "CONTENT",
				contentId: movie.id,
			})
		).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));

		await expect(
			caller.commerce.payment.markSuccess({
				orderId: "00000000-0000-0000-0000-000000000000",
				provider: "mock",
				providerTransactionId: "missing-order-txn",
			})
		).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
	});
});
