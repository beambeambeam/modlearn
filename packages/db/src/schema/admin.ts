import { relations } from "drizzle-orm";
import {
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const adminAuditLog = pgTable(
	"admin_audit_log",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		adminId: text("admin_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		entityId: uuid("entity_id").notNull(),
		entityType: text("entity_type").notNull(),
		action: text("action").notNull(),
		metadata: jsonb("metadata"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		ipAddress: text("ip_address"),
	},
	(table) => [
		index("adminAuditLog_adminId_idx").on(table.adminId),
		index("adminAuditLog_entity_idx").on(table.entityType, table.entityId),
		index("adminAuditLog_createdAt_idx").on(table.createdAt),
	]
);

export const adminAuditLogRelations = relations(adminAuditLog, ({ one }) => ({
	admin: one(user, {
		fields: [adminAuditLog.adminId],
		references: [user.id],
	}),
}));
