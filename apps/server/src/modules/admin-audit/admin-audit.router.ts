import { listAdminAuditLogs } from "@/modules/admin-audit/admin-audit.service";
import {
	adminAuditListInputSchema,
	adminAuditListOutputSchema,
} from "@/modules/admin-audit/admin-audit.validators";
import { adminProcedure, router } from "@/orpc";

export const adminAuditRouter = router({
	list: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/adminAudit/list",
			tags: ["Admin Audit Admin"],
			summary: "List Admin Audit Log Entries",
			description:
				"Requires admin or superadmin role. Returns paginated admin mutation audit logs.",
		})
		.input(adminAuditListInputSchema.optional())
		.output(adminAuditListOutputSchema)
		.handler(({ context, input }) => {
			return listAdminAuditLogs({
				db: context.db,
				input: adminAuditListInputSchema.parse(input ?? {}),
			});
		}),
});
