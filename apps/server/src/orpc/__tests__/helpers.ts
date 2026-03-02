import { createRouterClient } from "@orpc/server";
import { db } from "@/lib/db";
import type { Context } from "@/orpc/context";
import { appRouter } from "@/orpc/router";

export function makeTestContext(overrides?: Partial<Context>): Context {
	return {
		db,
		session: null,
		...overrides,
	};
}

export function makeAuthenticatedContext(
	userId: string,
	role = "user",
	overrides?: Partial<Context>
): Context {
	return {
		db,
		session: {
			user: {
				id: userId,
				email: "test@example.com",
				name: "Test User",
				emailVerified: false,
				image: null,
				role,
				banned: false,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			session: {
				id: "test-session-id",
				userId,
				expiresAt: new Date(Date.now() + 86_400_000),
				token: "test-token",
				ipAddress: null,
				userAgent: null,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		},
		...overrides,
	};
}

export function createCaller(context: Context) {
	return createRouterClient(appRouter, {
		context,
	});
}
