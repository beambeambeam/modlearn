import { auth } from "@modlearn/auth";
import type { Context as ElysiaContext } from "elysia";

interface NewType {
	context: ElysiaContext;
}

export type CreateContextOptions = NewType;

export async function createContext({ context }: CreateContextOptions) {
	const session = await auth.api.getSession({
		headers: context.request.headers,
	});
	return {
		session,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
