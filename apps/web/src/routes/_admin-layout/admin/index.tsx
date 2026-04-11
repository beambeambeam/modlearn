import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin-layout/admin/")({
	beforeLoad: () => {
		redirect({ to: "/admin/dashboard", throw: true });
	},
	component: () => null,
});
