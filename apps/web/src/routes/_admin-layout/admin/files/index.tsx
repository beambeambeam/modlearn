import { createFileRoute } from "@tanstack/react-router";
import FileManager from "@/components/admin/files/file-manager";

export const Route = createFileRoute("/_admin-layout/admin/files/")({
  component: FilesPage,
});

function FilesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Files</h1>
        <p className="text-muted-foreground mt-1">
          Upload and manage files for content and thumbnails.
        </p>
      </div>
      <FileManager />
    </div>
  );
}