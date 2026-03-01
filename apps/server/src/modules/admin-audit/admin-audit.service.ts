import { adminAuditLog } from "@/lib/db/schema";
import type { CreateAdminAuditLogParams } from "./admin-audit.types";

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
