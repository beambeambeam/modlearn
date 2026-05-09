import { createFileRoute } from "@tanstack/react-router";
import CategoryManager from "@/components/admin/categories/category-manager";

export const Route = createFileRoute("/_admin-layout/admin/categories/")({
  component: CategoriesPage,
});

function CategoriesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Categories</h1>
        <p className="text-muted-foreground mt-1">
          Manage content categories for the platform.
        </p>
      </div>
      <CategoryManager />
    </div>
  );
}