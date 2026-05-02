import { createFileRoute } from "@tanstack/react-router";
import UserTable from "@/components/admin/users/user-table";

export const Route = createFileRoute("/_admin-layout/admin/users/")({
  component: UsersPage,
});

function UsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground mt-1">
          Manage platform users, roles, and access.
        </p>
      </div>
      <UserTable />
    </div>
  );
}