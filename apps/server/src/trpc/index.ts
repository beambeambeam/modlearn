import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "@/trpc/context";

export const t = initTRPC.context<Context>().create();

export const router = t.router;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.session) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Authentication required",
			cause: "No session",
		});
	}
	return next({
		ctx: {
			...ctx,
			session: ctx.session,
		},
	});
});

const adminRoles = new Set(["admin", "superadmin"]);

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
	const role = ctx.session.user.role ?? "user";
	if (!adminRoles.has(role)) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Admin access required",
			cause: "Insufficient role",
		});
	}
	return next({
		ctx,
	});
});
