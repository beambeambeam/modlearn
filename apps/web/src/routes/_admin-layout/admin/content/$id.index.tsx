import { createFileRoute } from "@tanstack/react-router";
import ContentForm from "@/components/admin/content/content-form";

export const Route = createFileRoute("/_admin-layout/admin/content/$id/")({
	component: EditContentPage,
});

function EditContentPage() {
	const { id } = Route.useParams();
	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 text-muted-foreground text-sm">
				<span>Content</span>
				<span>{">"}</span>
				<span className="font-medium text-primary">Edit Content</span>
			</div>
			<ContentForm id={id} />
		</div>
	);
}
