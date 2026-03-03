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
			tags: ["Admin Audit"],
			summary: "List admin audit logs",
			description: "Requires admin or superadmin role.",
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
