import { createFileRoute } from "@tanstack/react-router";
import CategoryManager from "@/components/admin/categories/category-manager";

export const Route = createFileRoute("/_admin-layout/admin/categories/")({
	component: CategoriesPage,
});

function CategoriesPage() {
	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-bold text-2xl">Categories</h1>
				<p className="mt-1 text-muted-foreground">
					Manage content categories for the platform.
				</p>
			</div>
			<CategoryManager />
		</div>
	);
}
