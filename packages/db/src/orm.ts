import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type * as schema from "./schema";

// biome-ignore lint/performance/noBarrelFile: Re-export to keep a single drizzle-orm instance across packages.
export { and, eq } from "drizzle-orm";

export type DbClient =
	| NodePgDatabase<typeof schema>
	| PgliteDatabase<typeof schema>;
