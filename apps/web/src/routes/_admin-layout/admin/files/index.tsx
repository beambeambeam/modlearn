import { createFileRoute } from "@tanstack/react-router";
import FileManager from "@/components/admin/files/file-manager";

export const Route = createFileRoute("/_admin-layout/admin/files/")({
	component: FilesPage,
});

function FilesPage() {
	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-bold text-2xl">Files</h1>
				<p className="mt-1 text-muted-foreground">
					Upload and manage files for content and thumbnails.
				</p>
			</div>
			<FileManager />
		</div>
	);
}
