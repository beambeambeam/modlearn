import { createFileRoute } from "@tanstack/react-router";
import UserTable from "@/components/admin/users/user-table";

export const Route = createFileRoute("/_admin-layout/admin/users/")({
	component: UsersPage,
});

function UsersPage() {
	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-bold text-2xl">Users</h1>
				<p className="mt-1 text-muted-foreground">
					Manage platform users, roles, and access.
				</p>
			</div>
			<UserTable />
		</div>
	);
}
