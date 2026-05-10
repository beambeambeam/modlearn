import { createFileRoute } from "@tanstack/react-router";
import ContentTable from "@/components/admin/content/content-table";

export const Route = createFileRoute("/_admin-layout/admin/content/")({
	component: ContentListPage,
});

function ContentListPage() {
	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-bold text-2xl">Content</h1>
				<p className="mt-1 text-muted-foreground">
					Manage all content on the platform.
				</p>
			</div>
			<ContentTable />
		</div>
	);
}
