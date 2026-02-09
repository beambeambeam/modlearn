import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	createAuthenticatedUser,
	createTestUser,
} from "@/__tests__/helpers/factories";
import { makeTestContext } from "@/trpc/__tests__/helpers";
import { appRouter } from "@/trpc/routers/index";
import {
	createTestDatabase,
	resetTestDatabase,
	type TestDatabase,
} from "./helpers/test-db";

describe("Database Integration Example", () => {
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

	describe("User queries", () => {
		it("should create and retrieve a user", async () => {
			const user = await createTestUser(testDb.client, {
				name: "John Doe",
				email: "john@example.com",
			});

			expect(user.name).toBe("John Doe");
			expect(user.email).toBe("john@example.com");
			expect(user.id).toBeDefined();
		});

		it("should create authenticated user with session", async () => {
			const { user, session } = await createAuthenticatedUser(testDb.client, {
				name: "Jane Doe",
				email: "jane@example.com",
			});

			expect(user.email).toBe("jane@example.com");
			expect(session.userId).toBe(user.id);
			expect(session.token).toBeDefined();
		});
	});

	describe("tRPC with database", () => {
		it("should use database in tRPC procedures", async () => {
			// Create a user in the test database
			const { user, session } = await createAuthenticatedUser(testDb.client, {
				name: "Test User",
				email: "test@example.com",
			});

			// Create context with the session
			const ctx = makeTestContext({
				session: {
					user: {
						id: user.id,
						email: user.email,
						name: user.name,
						emailVerified: user.emailVerified,
						image: user.image,
						banned: user.banned ?? false,
						createdAt: user.createdAt,
						updatedAt: user.updatedAt,
					},
					session: {
						id: session.id,
						userId: session.userId,
						expiresAt: session.expiresAt,
						token: session.token,
						ipAddress: session.ipAddress,
						userAgent: session.userAgent,
						createdAt: session.createdAt,
						updatedAt: session.updatedAt,
					},
				},
			});

			const caller = appRouter.createCaller(ctx);

			// Call a protected procedure
			const result = await caller.privateData();

			expect(result.message).toBe("This is private");
			expect(result.user.email).toBe("test@example.com");
		});
	});
});
