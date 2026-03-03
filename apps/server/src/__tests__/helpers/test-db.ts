import { existsSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, migrate } from "@/lib/db/pglite";
// biome-ignore lint/performance/noNamespaceImport: Drizzle schema registration needs the full module.
import * as schema from "@/lib/db/schema/index";

export interface TestDatabase {
	db: ReturnType<typeof drizzle<typeof schema>>;
	client: PGlite;
	cleanup: () => Promise<void>;
}

const ROOT_MIGRATIONS_FOLDER = path.resolve(
	process.cwd(),
	"apps/server/src/lib/db/migrations"
);
const SERVER_CWD_MIGRATIONS_FOLDER = path.resolve(
	process.cwd(),
	"src/lib/db/migrations"
);
const MIGRATIONS_FOLDER = existsSync(ROOT_MIGRATIONS_FOLDER)
	? ROOT_MIGRATIONS_FOLDER
	: SERVER_CWD_MIGRATIONS_FOLDER;

export async function createTestDatabase(): Promise<TestDatabase> {
	// Create in-memory PostgreSQL instance
	const client = new PGlite();

	// Create drizzle instance with schema
	const db = drizzle(client, { schema });

	// Bootstrap schema in the in-memory test database.
	await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

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
		"admin_audit_log",
		"account",
		"cart_item",
		"cart",
		"content_category",
		"content_pricing",
		"content_purchase",
		"content_view",
		"content",
		"file",
		"order_item",
		"payment",
		"playlist_content",
		"playlist_episode",
		"playlist_pricing",
		"playlist",
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
