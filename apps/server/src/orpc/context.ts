import { db } from "@/lib/db";
import type { DbClient } from "@/lib/db/orm";
import { auth } from "../lib/auth";
import type { CreateContextOptions } from "./context.types";

export async function createContext({ context }: CreateContextOptions) {
	const session = await auth.api.getSession({
		headers: context.request.headers,
	});
	return {
		db: db as DbClient,
		session,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
