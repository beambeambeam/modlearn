import type { DbClient } from "@/lib/db/orm";

export type AuditEntityType =
	| "CONTENT"
	| "PLAYLIST"
	| "PLAYLIST_EPISODE"
	| "CATEGORY"
	| "GENRE"
	| "FILE";

export type AuditAction =
	| "CREATE"
	| "UPDATE"
	| "DELETE"
	| "SET_PUBLISH_STATE"
	| "SET_AVAILABILITY"
	| "SET_CLASSIFICATION"
	| "ADD_EPISODE"
	| "REORDER_EPISODES";

export interface AuditLogInput {
	adminId: string;
	entityId: string;
	entityType: AuditEntityType;
	action: AuditAction;
	metadata?: Record<string, unknown> | null;
	ipAddress?: string | null;
}

export interface CreateAdminAuditLogParams {
	db: DbClient;
	input: AuditLogInput;
}
