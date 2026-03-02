import { ORPCError } from "@orpc/server";
import { createAdminAuditLog } from "@/modules/admin-audit/admin-audit.service";
import type { LogAdminMutationParams } from "./_audit.types";

export async function logAdminMutation(
	params: LogAdminMutationParams
): Promise<void> {
	const { context, entityType, action, entityId, metadata } = params;

	try {
		await createAdminAuditLog({
			db: context.db,
			input: {
				adminId: context.session.user.id,
				entityId,
				entityType,
				action,
				metadata: metadata ?? null,
				ipAddress: null,
			},
		});
	} catch {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Failed to write admin audit log",
		});
	}
}
