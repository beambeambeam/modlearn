import type { Context } from "../context";

export function makeTestContext(overrides?: Partial<Context>): Context {
	return {
		session: null,
		...overrides,
	};
}

export function makeAuthenticatedContext(
	userId: string,
	role = "user"
): Context {
	return {
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
				expiresAt: new Date(Date.now() + 86_400_000), // 24 hours
				token: "test-token",
				ipAddress: null,
				userAgent: null,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		},
	};
}
