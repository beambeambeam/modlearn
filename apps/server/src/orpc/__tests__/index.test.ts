import { createRouterClient, ORPCError } from "@orpc/server";
import { describe, expect, it, vi } from "vitest";
import { CategoryNotFoundError } from "@/modules/category/category.types";
import { publicProcedure, router } from "@/orpc";
import { rpcErrorInterceptor } from "@/orpc/error-mapper";
import {
	createCaller,
	makeAuthenticatedContext,
	makeTestContext,
} from "./helpers";

describe("orpc procedures", () => {
	describe("publicProcedure", () => {
		it("should allow access without authentication", async () => {
			const testRouter = router({
				ping: publicProcedure.handler(() => {
					return "pong";
				}),
			});
			const context = makeTestContext();
			const caller = createRouterClient(testRouter, { context });

			const result = await caller.ping();

			expect(result).toBe("pong");
		});
	});

	describe("privateData (protected)", () => {
		it("should throw UNAUTHORIZED when session is null", async () => {
			const context = makeTestContext();
			const caller = createCaller(context);

			await expect(caller.privateData()).rejects.toThrow(
				expect.objectContaining({
					code: "UNAUTHORIZED",
				})
			);
		});

		it("should return data when authenticated", async () => {
			const context = makeAuthenticatedContext("test-user-id");
			const caller = createCaller(context);

			const result = await caller.privateData();

			expect(result.message).toBe("This is private");
			expect(result.user.email).toBe("test@example.com");
		});
	});

	describe("adminData (admin)", () => {
		it("should throw UNAUTHORIZED when session is null", async () => {
			const context = makeTestContext();
			const caller = createCaller(context);

			await expect(caller.adminData()).rejects.toThrow(
				expect.objectContaining({
					code: "UNAUTHORIZED",
				})
			);
		});

		it("should throw FORBIDDEN when role is not admin", async () => {
			const context = makeAuthenticatedContext("test-user-id", "user");
			const caller = createCaller(context);

			await expect(caller.adminData()).rejects.toThrow(
				expect.objectContaining({
					code: "FORBIDDEN",
				})
			);
		});

		it("should return data when role is admin", async () => {
			const context = makeAuthenticatedContext("test-admin-id", "admin");
			const caller = createCaller(context);

			const result = await caller.adminData();

			expect(result.message).toBe("This is admin-only");
			expect(result.user.id).toBe("test-admin-id");
		});

		it("should return data when role is superadmin", async () => {
			const context = makeAuthenticatedContext(
				"test-superadmin-id",
				"superadmin"
			);
			const caller = createCaller(context);

			const result = await caller.adminData();

			expect(result.message).toBe("This is admin-only");
			expect(result.user.id).toBe("test-superadmin-id");
		});
	});

	describe("rpcErrorInterceptor", () => {
		it("maps known domain errors to ORPCError", async () => {
			const error = new CategoryNotFoundError();

			await expect(
				rpcErrorInterceptor({
					request: {
						method: "GET",
						pathname: "/rpc/test",
					},
					next: () => Promise.reject(error),
				} as never)
			).rejects.toThrow(
				expect.objectContaining({
					code: "NOT_FOUND",
					message: error.message,
				})
			);
		});

		it("masks unknown non-ORPC throwables as INTERNAL_SERVER_ERROR", async () => {
			const errorSpy = vi
				.spyOn(console, "error")
				.mockImplementation(() => undefined);

			const nonErrorThrowable = "oops";

			await expect(
				rpcErrorInterceptor({
					request: {
						method: "GET",
						pathname: "/rpc/test",
					},
					next: () => Promise.reject(nonErrorThrowable),
				} as never)
			).rejects.toThrow(
				expect.objectContaining({
					code: "INTERNAL_SERVER_ERROR",
					message: "Internal server error",
				})
			);

			errorSpy.mockRestore();
		});

		it("passes through existing ORPCError", async () => {
			const original = new ORPCError("FORBIDDEN", {
				message: "No access",
			});

			await expect(
				rpcErrorInterceptor({
					request: {
						method: "GET",
						pathname: "/rpc/test",
					},
					next: () => Promise.reject(original),
				} as never)
			).rejects.toBe(original);
		});
	});
});
