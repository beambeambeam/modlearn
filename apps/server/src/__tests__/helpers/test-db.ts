import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, migrate } from "@modlearn/db/pglite";
// biome-ignore lint/performance/noNamespaceImport: Drizzle schema registration needs the full module.
import * as schema from "@modlearn/db/schema/index";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export interface TestDatabase {
	db: ReturnType<typeof drizzle<typeof schema>>;
	client: PGlite;
	cleanup: () => Promise<void>;
}

/**
 * Creates a test database with PGlite (in-memory PostgreSQL)
 * Usage:
 * ```ts
 * let testDb: TestDatabase;
 *
 * beforeAll(async () => {
 *   testDb = await createTestDatabase();
 * });
 *
 * afterAll(async () => {
 *   await testDb.cleanup();
 * });
 * ```
 */
function findMigrationsFolder(): string {
	const candidates = [
		resolve(process.cwd(), "packages/db/src/migrations"),
		resolve(__dirname, "../../../../..", "packages/db/src/migrations"),
		resolve(__dirname, "../../../../../..", "packages/db/src/migrations"),
	];

	for (const candidate of candidates) {
		if (existsSync(resolve(candidate, "meta/_journal.json"))) {
			return candidate;
		}
	}

	return candidates[0] ?? resolve(process.cwd(), "packages/db/src/migrations");
}

export async function createTestDatabase(): Promise<TestDatabase> {
	// Create in-memory PostgreSQL instance
	const client = new PGlite();

	// Create drizzle instance with schema
	const db = drizzle(client, { schema });

	// Run migrations from packages/db/src/migrations
	const migrationsFolder = findMigrationsFolder();
	await migrate(db, { migrationsFolder });

	return {
		db,
		client,
		cleanup: async () => {
			await client.close();
		},
	};
}

export async function resetTestDatabase(client: PGlite): Promise<void> {
	const tables = [
		"account",
		"session",
		"user",
		"verification",
		"course",
		"course_module",
		"course_lesson",
		"lesson_progress",
		"enrollment",
		"media",
		"playlist",
		"playlist_item",
		"subscription",
		"payment",
		"webhook_event",
		"admin_settings",
		"streaming_session",
		"content_assignment",
	];

	// Truncate all tables
	for (const table of tables) {
		try {
			await client.exec(`TRUNCATE TABLE "${table}" CASCADE`);
		} catch {
			// Table might not exist, ignore
		}
	}
}
