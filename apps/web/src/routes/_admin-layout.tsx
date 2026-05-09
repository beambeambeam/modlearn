import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import AdminHeader from "@/components/admin/admin-header";
import AdminSidebar from "@/components/admin/admin-sidebar";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_admin-layout")({
	beforeLoad: async () => {
		const session = await authClient.getSession();

		if (!session.data) {
		  redirect({ to: "/login", throw: true });
		}

		if (session.data?.user.role !== "admin" && session.data?.user.role !== "superadmin") {
		  redirect({ to: "/dashboard", throw: true });
		}

		return { session };
	},
	component: AdminLayoutComponent,
});

function AdminLayoutComponent() {
	return (
		<div className="flex h-screen bg-background">
			<AdminSidebar />
			<div className="flex flex-1 flex-col overflow-hidden">
				<AdminHeader />
				<main className="flex-1 overflow-y-auto p-6">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
