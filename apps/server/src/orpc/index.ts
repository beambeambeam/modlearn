import { ORPCError, os } from "@orpc/server";
import type { Context } from "./context";
import { mapDomainErrorToOrpc, toInternalOrpcError } from "./error-mapper";

const base = os.$context<Context>().use(async ({ next }) => {
	try {
		return await next();
	} catch (error) {
		if (error instanceof ORPCError) {
			throw error;
		}

		const mapped = mapDomainErrorToOrpc(error);
		if (mapped) {
			throw mapped;
		}

		throw toInternalOrpcError(error);
	}
});

export const router = <TRouter extends Record<string, unknown>>(
	routerShape: TRouter
): TRouter => routerShape;

export const publicProcedure = base;

export const protectedProcedure = base.use(({ context, next }) => {
	if (!context.session) {
		throw new ORPCError("UNAUTHORIZED", {
			message: "Authentication required",
			cause: "No session",
		});
	}

	return next({
		context: {
			...context,
			session: context.session,
		},
	});
});

const adminRoles = new Set(["admin", "superadmin"]);

export const adminProcedure = protectedProcedure.use(({ context, next }) => {
	const role = context.session.user.role ?? "user";

	if (!adminRoles.has(role)) {
		throw new ORPCError("FORBIDDEN", {
			message: "Admin access required",
			cause: "Insufficient role",
		});
	}

	return next({
		context,
	});
});
