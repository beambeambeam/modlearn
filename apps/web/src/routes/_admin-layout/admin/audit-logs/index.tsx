import { createFileRoute } from "@tanstack/react-router";
import AuditLogTable from "@/components/admin/audit-logs/audit-log-table";

export const Route = createFileRoute("/_admin-layout/admin/audit-logs/")({
  component: AuditLogsPage,
});

function AuditLogsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <p className="text-muted-foreground mt-1">
          Track all admin actions across the platform.
        </p>
      </div>
      <AuditLogTable />
    </div>
  );
}