import type { DbClient } from "@/lib/db/orm";
import { adminAuditLog } from "@/lib/db/schema";
import type { AuditLogInput } from "./admin-audit.types";

interface CreateAdminAuditLogParams {
	db: DbClient;
	input: AuditLogInput;
}

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
