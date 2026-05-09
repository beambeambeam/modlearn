import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin-layout/admin/content/$id")({
  component: () => <Outlet />,
});