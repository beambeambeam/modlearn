import { describe, expect, it } from "vitest";
import { publicProcedure, router } from "@/trpc";
import { appRouter } from "@/trpc/routers";
import { makeAuthenticatedContext, makeTestContext } from "./helpers";

describe("trpc procedures", () => {
	describe("publicProcedure", () => {
		it("should allow access without authentication", async () => {
			const testRouter = router({
				ping: publicProcedure.query(() => {
					return "pong";
				}),
			});
			const ctx = makeTestContext();
			const caller = testRouter.createCaller(ctx);

			const result = await caller.ping();

			expect(result).toBe("pong");
		});
	});

	describe("privateData (protected)", () => {
		it("should throw UNAUTHORIZED when session is null", async () => {
			const ctx = makeTestContext();
			const caller = appRouter.createCaller(ctx);

			await expect(caller.privateData()).rejects.toThrow(
				expect.objectContaining({
					code: "UNAUTHORIZED",
				})
			);
		});

		it("should return data when authenticated", async () => {
			const ctx = makeAuthenticatedContext("test-user-id");
			const caller = appRouter.createCaller(ctx);

			const result = await caller.privateData();

			expect(result.message).toBe("This is private");
			expect(result.user.email).toBe("test@example.com");
		});
	});

	describe("adminData (admin)", () => {
		it("should throw UNAUTHORIZED when session is null", async () => {
			const ctx = makeTestContext();
			const caller = appRouter.createCaller(ctx);

			await expect(caller.adminData()).rejects.toThrow(
				expect.objectContaining({
					code: "UNAUTHORIZED",
				})
			);
		});

		it("should throw FORBIDDEN when role is not admin", async () => {
			const ctx = makeAuthenticatedContext("test-user-id", "user");
			const caller = appRouter.createCaller(ctx);

			await expect(caller.adminData()).rejects.toThrow(
				expect.objectContaining({
					code: "FORBIDDEN",
				})
			);
		});

		it("should return data when role is admin", async () => {
			const ctx = makeAuthenticatedContext("test-admin-id", "admin");
			const caller = appRouter.createCaller(ctx);

			const result = await caller.adminData();

			expect(result.message).toBe("This is admin-only");
			expect(result.user.id).toBe("test-admin-id");
		});

		it("should return data when role is superadmin", async () => {
			const ctx = makeAuthenticatedContext("test-superadmin-id", "superadmin");
			const caller = appRouter.createCaller(ctx);

			const result = await caller.adminData();

			expect(result.message).toBe("This is admin-only");
			expect(result.user.id).toBe("test-superadmin-id");
		});
	});
});
