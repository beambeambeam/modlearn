import { os } from "@orpc/server";
import type { Context } from "./context";
import { commonErrors } from "./errors";

const base = os.$context<Context>().errors(commonErrors);

export const router = <TRouter extends Record<string, unknown>>(
	routerShape: TRouter
): TRouter => routerShape;

export const publicProcedure = base;

export const protectedProcedure = base.use(({ context, errors, next }) => {
	if (!context.session) {
		throw errors.UNAUTHORIZED({
			message: commonErrors.UNAUTHORIZED.message,
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

export const adminProcedure = protectedProcedure.use(
	({ context, errors, next }) => {
		const role = context.session.user.role ?? "user";

		if (!adminRoles.has(role)) {
			throw errors.FORBIDDEN({
				message: commonErrors.FORBIDDEN.message,
			});
		}

		return next({
			context,
		});
	}
);
