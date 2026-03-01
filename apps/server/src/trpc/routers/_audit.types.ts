import type {
	AuditAction,
	AuditEntityType,
} from "@/modules/admin-audit/admin-audit.types";
import type { Context } from "../context";

export interface LogAdminMutationParams {
	ctx: Context & { session: NonNullable<Context["session"]> };
	entityType: AuditEntityType;
	action: AuditAction;
	entityId: string;
	metadata?: Record<string, unknown> | null;
}
