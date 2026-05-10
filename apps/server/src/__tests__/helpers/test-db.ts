import { PGlite } from "@electric-sql/pglite";
import { pushSchema } from "drizzle-kit/api";
import { drizzle } from "@/lib/db/pglite";
// biome-ignore lint/performance/noNamespaceImport: Drizzle schema registration needs the full module.
import * as schema from "@/lib/db/schema/index";

export interface TestDatabase {
	db: ReturnType<typeof drizzle<typeof schema>>;
	client: PGlite;
	cleanup: () => Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabase> {
	// Create in-memory PostgreSQL instance
	const client = new PGlite();

	// Create drizzle instance with schema
	const db = drizzle(client, { schema });

	// Bootstrap the in-memory database from the current schema instead of
	// replaying repository migrations. This keeps tests aligned with source
	// schema changes even when historical generated migrations are stale.
	const schemaPush = await pushSchema(
		schema,
		db as unknown as Parameters<typeof pushSchema>[1]
	);
	await schemaPush.apply();

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
		"course",
		"course_category",
		"course_lesson",
		"course_lesson_view",
		"course_pricing",
		"course_review",
		"course_purchase",
		"file",
		"payment",
		"session",
		"storage",
		"user_library",
		"verification",
		"watch_progress",
		"user",
		"category",
		"order",
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
