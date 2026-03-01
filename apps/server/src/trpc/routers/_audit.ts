import { TRPCError } from "@trpc/server";
import { createAdminAuditLog } from "@/modules/admin-audit/admin-audit.service";
import type {
	AuditAction,
	AuditEntityType,
} from "@/modules/admin-audit/admin-audit.types";
import type { Context } from "../context";

interface LogAdminMutationParams {
	ctx: Context & { session: NonNullable<Context["session"]> };
	entityType: AuditEntityType;
	action: AuditAction;
	entityId: string;
	metadata?: Record<string, unknown> | null;
}

export async function logAdminMutation(
	params: LogAdminMutationParams
): Promise<void> {
	const { ctx, entityType, action, entityId, metadata } = params;

	try {
		await createAdminAuditLog({
			db: ctx.db,
			input: {
				adminId: ctx.session.user.id,
				entityId,
				entityType,
				action,
				metadata: metadata ?? null,
				ipAddress: null,
			},
		});
	} catch {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to write admin audit log",
		});
	}
}
