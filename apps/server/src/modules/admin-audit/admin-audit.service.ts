import { ORPCError } from "@orpc/server";
import { adminAuditLog } from "@/lib/db/schema";
import type {
	CreateAdminAuditLogParams,
	LogAdminMutationParams,
} from "./admin-audit.types";

export async function createAdminAuditLog(
	params: CreateAdminAuditLogParams
): Promise<typeof adminAuditLog.$inferSelect> {
	const { db, input } = params;

	const [created] = await db
		.insert(adminAuditLog)
		.values({
			adminId: input.adminId,
			entityId: input.entityId,
			entityType: input.entityType,
			action: input.action,
			metadata: input.metadata ?? null,
			ipAddress: input.ipAddress ?? null,
		})
		.returning();

	if (!created) {
		throw new Error("Failed to create admin audit log");
	}

	return created;
}

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
