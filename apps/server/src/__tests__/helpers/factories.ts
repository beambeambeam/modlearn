import type { PGlite } from "@electric-sql/pglite";
import type { session, user } from "@modlearn/db/schema/auth";

export interface CreateUserInput {
	id?: string;
	name?: string;
	email?: string;
	emailVerified?: boolean;
	image?: string | null;
	username?: string | null;
	displayUsername?: string | null;
	role?: string | null;
	banned?: boolean;
	banReason?: string | null;
	banExpires?: Date | null;
}

export async function createTestUser(
	client: PGlite,
	input: CreateUserInput = {}
): Promise<typeof user.$inferSelect> {
	const now = new Date();
	const id =
		input.id ??
		`test-user-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
	const email = input.email ?? `test-${Date.now()}@example.com`;

	const result = await client.query<typeof user.$inferSelect>(
		`INSERT INTO "user" (
			id, name, email, email_verified, image, username, display_username, role, banned, ban_reason, ban_expires, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING
			id,
			name,
			email,
			email_verified AS "emailVerified",
			image,
			username,
			display_username AS "displayUsername",
			role,
			banned,
			ban_reason AS "banReason",
			ban_expires AS "banExpires",
			created_at AS "createdAt",
			updated_at AS "updatedAt"`,
		[
			id,
			input.name ?? "Test User",
			email,
			input.emailVerified ?? false,
			input.image ?? null,
			input.username ?? null,
			input.displayUsername ?? null,
			input.role ?? "user",
			input.banned ?? false,
			input.banReason ?? null,
			input.banExpires ?? null,
			now,
			now,
		]
	);

	const row = result.rows[0];
	if (!row) {
		throw new Error("Failed to create test user");
	}

	return row;
}

export function createTestAdminUser(
	client: PGlite,
	input: CreateUserInput = {}
): Promise<typeof user.$inferSelect> {
	const role = input.role ?? "admin";
	return createTestUser(client, { ...input, role });
}

export interface CreateSessionInput {
	id?: string;
	userId: string;
	token?: string;
	expiresAt?: Date;
	ipAddress?: string | null;
	userAgent?: string | null;
	impersonatedBy?: string | null;
}

export async function createTestSession(
	client: PGlite,
	input: CreateSessionInput
): Promise<typeof session.$inferSelect> {
	const now = new Date();
	const id =
		input.id ??
		`test-session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
	const token =
		input.token ??
		`test-token-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
	const expiresAt =
		input.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

	const result = await client.query<typeof session.$inferSelect>(
		`INSERT INTO "session" (
			id, user_id, token, expires_at, ip_address, user_agent, impersonated_by, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING
			id,
			expires_at AS "expiresAt",
			token,
			created_at AS "createdAt",
			updated_at AS "updatedAt",
			ip_address AS "ipAddress",
			user_agent AS "userAgent",
			user_id AS "userId",
			impersonated_by AS "impersonatedBy"`,
		[
			id,
			input.userId,
			token,
			expiresAt,
			input.ipAddress ?? null,
			input.userAgent ?? null,
			input.impersonatedBy ?? null,
			now,
			now,
		]
	);

	const row = result.rows[0];
	if (!row) {
		throw new Error("Failed to create test session");
	}

	return row;
}

export interface CreateAuthenticatedUserResult {
	user: typeof user.$inferSelect;
	session: typeof session.$inferSelect;
}

export async function createAuthenticatedUser(
	client: PGlite,
	userInput: CreateUserInput = {}
): Promise<CreateAuthenticatedUserResult> {
	const user = await createTestUser(client, userInput);
	const session = await createTestSession(client, { userId: user.id });

	return { user, session };
}

export function createAuthenticatedAdminUser(
	client: PGlite,
	userInput: CreateUserInput = {}
): Promise<CreateAuthenticatedUserResult> {
	const role = userInput.role ?? "admin";
	return createAuthenticatedUser(client, { ...userInput, role });
}
