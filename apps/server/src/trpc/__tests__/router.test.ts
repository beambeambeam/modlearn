import { describe, expect, it } from "vitest";
import { appRouter } from "../routers/index";
import { makeAuthenticatedContext, makeTestContext } from "./helpers";

describe("appRouter", () => {
	describe("healthCheck (public)", () => {
		it("should return OK without authentication", async () => {
			const ctx = makeTestContext();
			const caller = appRouter.createCaller(ctx);

			const result = await caller.healthCheck();

			expect(result).toBe("OK");
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
});
