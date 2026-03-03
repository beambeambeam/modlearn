import type { DbClient } from "@/lib/db/orm";
import type { Context } from "@/orpc/context";

export type AuditEntityType =
	| "CONTENT"
	| "PLAYLIST"
	| "PLAYLIST_EPISODE"
	| "CATEGORY"
	| "FILE";

export type AuditAction =
	| "CREATE"
	| "UPDATE"
	| "DELETE"
	| "SET_PUBLISH_STATE"
	| "SET_AVAILABILITY"
	| "SET_CLASSIFICATION"
	| "ADD_EPISODE"
	| "REORDER_EPISODES"
	| "UPDATE_EPISODE"
	| "REMOVE_EPISODE";

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

export interface LogAdminMutationParams {
	context: Context & { session: NonNullable<Context["session"]> };
	entityType: AuditEntityType;
	action: AuditAction;
	entityId: string;
	metadata?: Record<string, unknown> | null;
}

export interface AdminAuditListInput {
	page?: number;
	limit?: number;
	adminId?: string;
	entityId?: string;
	entityType?: AuditEntityType;
	action?: AuditAction;
	from?: Date;
	to?: Date;
}

export interface AdminAuditListItem {
	id: string;
	adminId: string;
	entityId: string;
	entityType: AuditEntityType;
	action: AuditAction;
	metadata: Record<string, unknown> | null;
	createdAt: Date;
	ipAddress: string | null;
	admin: {
		id: string;
		email: string;
		name: string;
	};
}

export interface AdminAuditPagination {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
}

export interface AdminAuditListResult {
	items: AdminAuditListItem[];
	pagination: AdminAuditPagination;
}

export interface AdminAuditListParams {
	db: DbClient;
	input: AdminAuditListInput;
}
