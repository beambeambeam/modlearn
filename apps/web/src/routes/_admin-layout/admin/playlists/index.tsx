import { createFileRoute } from "@tanstack/react-router";
import ManageCourseTable from "@/components/admin/playlists/manage-playlist-table";

export const Route = createFileRoute("/_admin-layout/admin/playlists/")({
	component: ManageCoursePage,
});

function ManageCoursePage() {
	return (
		<div className="space-y-6">
			{/* Breadcrumb */}
			<div className="flex items-center gap-2 text-muted-foreground text-sm">
				<span>Course</span>
				<span>{">"}</span>
				<span className="font-medium text-primary">Manage Course</span>
			</div>

			{/* Title */}
			<div>
				<h1 className="font-bold text-3xl">Manage Course</h1>
				<p className="mt-1 text-muted-foreground">
					Review, update, and organize your education curriculum.
				</p>
			</div>

			<ManageCourseTable />
		</div>
	)
}
