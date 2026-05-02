import { createFileRoute } from "@tanstack/react-router";
import AddCourseForm from "@/components/admin/playlists/add-playlist-form";

export const Route = createFileRoute("/_admin-layout/admin/playlists/new")({
  component: AddCoursePage,
});

function AddCoursePage() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Course</span>
        <span>{">"}</span>
        <span className="text-primary font-medium">Add New Course</span>
      </div>

      <AddCourseForm />
    </div>
  );
}