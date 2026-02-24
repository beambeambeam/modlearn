import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "@/lib/db/pglite";
// biome-ignore lint/performance/noNamespaceImport: Drizzle schema registration needs the full module.
import * as schema from "@/lib/db/schema/index";

export interface TestDatabase {
	db: ReturnType<typeof drizzle<typeof schema>>;
	client: PGlite;
	cleanup: () => Promise<void>;
}

export function createTestDatabase(): Promise<TestDatabase> {
	// Create in-memory PostgreSQL instance
	const client = new PGlite();

	// Create drizzle instance with schema
	const db = drizzle(client, { schema });

	// TODO: Re-enable migration bootstrap after new server-local migrations are rebuilt.

	return Promise.resolve({
		db,
		client,
		cleanup: async () => {
			await client.close();
		},
	});
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
