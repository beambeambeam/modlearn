import { ORPCError } from "@orpc/server";
import type { SQL } from "drizzle-orm";
import { and, count, desc, eq, gte, lte } from "drizzle-orm";
import { adminAuditLog, user } from "@/lib/db/schema";
import type {
	AdminAuditListParams,
	AdminAuditListResult,
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

function toPagination(params: { page: number; limit: number; total: number }) {
	const { page, limit, total } = params;
	return {
		page,
		limit,
		total,
		totalPages: total === 0 ? 0 : Math.ceil(total / limit),
	};
}

export async function listAdminAuditLogs(
	params: AdminAuditListParams
): Promise<AdminAuditListResult> {
	const { db, input } = params;
	const page = input.page ?? 1;
	const limit = input.limit ?? 20;
	const offset = (page - 1) * limit;
	const whereConditions: SQL<unknown>[] = [];

	if (input.adminId) {
		whereConditions.push(eq(adminAuditLog.adminId, input.adminId));
	}
	if (input.entityId) {
		whereConditions.push(eq(adminAuditLog.entityId, input.entityId));
	}
	if (input.entityType) {
		whereConditions.push(eq(adminAuditLog.entityType, input.entityType));
	}
	if (input.action) {
		whereConditions.push(eq(adminAuditLog.action, input.action));
	}
	if (input.from) {
		whereConditions.push(gte(adminAuditLog.createdAt, input.from));
	}
	if (input.to) {
		whereConditions.push(lte(adminAuditLog.createdAt, input.to));
	}

	const where =
		whereConditions.length > 0 ? and(...whereConditions) : undefined;

	const [countRow] = await db
		.select({ total: count() })
		.from(adminAuditLog)
		.where(where);
	const total = Number(countRow?.total ?? 0);

	const rows = await db
		.select({
			id: adminAuditLog.id,
			adminId: adminAuditLog.adminId,
			entityId: adminAuditLog.entityId,
			entityType: adminAuditLog.entityType,
			action: adminAuditLog.action,
			metadata: adminAuditLog.metadata,
			createdAt: adminAuditLog.createdAt,
			ipAddress: adminAuditLog.ipAddress,
			adminUserId: user.id,
			adminEmail: user.email,
			adminName: user.name,
		})
		.from(adminAuditLog)
		.innerJoin(user, eq(adminAuditLog.adminId, user.id))
		.where(where)
		.orderBy(desc(adminAuditLog.createdAt), desc(adminAuditLog.id))
		.limit(limit)
		.offset(offset);

	return {
		items: rows.map((row) => ({
			id: row.id,
			adminId: row.adminId,
			entityId: row.entityId,
			entityType:
				row.entityType as AdminAuditListResult["items"][number]["entityType"],
			action: row.action as AdminAuditListResult["items"][number]["action"],
			metadata: (row.metadata as Record<string, unknown> | null) ?? null,
			createdAt: row.createdAt,
			ipAddress: row.ipAddress,
			admin: {
				id: row.adminUserId,
				email: row.adminEmail,
				name: row.adminName,
			},
		})),
		pagination: toPagination({ page, limit, total }),
	};
}
