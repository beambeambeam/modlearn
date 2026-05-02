import { createFileRoute } from "@tanstack/react-router";
import ContentTable from "@/components/admin/content/content-table";

export const Route = createFileRoute("/_admin-layout/admin/content/")({
  component: ContentListPage,
});

function ContentListPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Content</h1>
        <p className="text-muted-foreground mt-1">
          Manage all content on the platform.
        </p>
      </div>
      <ContentTable />
    </div>
  );
}