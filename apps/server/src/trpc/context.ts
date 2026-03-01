import type { Context as ElysiaContext } from "elysia";
import { db } from "@/lib/db";
import type { DbClient } from "@/lib/db/orm";
import { auth } from "../lib/auth";

interface NewType {
	context: ElysiaContext;
}

export type CreateContextOptions = NewType;

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
