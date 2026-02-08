import { env } from "@modlearn/env/server";
import { drizzle } from "drizzle-orm/node-postgres";

// biome-ignore lint/performance/noNamespaceImport: Import all for Drizzle
import * as schema from "./schema";

export const db = drizzle(env.DATABASE_URL, { schema });
