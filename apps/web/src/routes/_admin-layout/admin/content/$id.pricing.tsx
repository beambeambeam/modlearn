import { createFileRoute } from "@tanstack/react-router";
import ContentPricing from "@/components/admin/content/content-pricing";

export const Route = createFileRoute(
	"/_admin-layout/admin/content/$id/pricing"
)({
	component: ContentPricingPage,
});

function ContentPricingPage() {
	const { id } = Route.useParams();
	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 text-muted-foreground text-sm">
				<span>Content</span>
				<span>{">"}</span>
				<button
					className="cursor-pointer hover:text-foreground"
					onClick={() => history.back()}
					type="button"
				>
					Edit Content
				</button>
				<span>{">"}</span>
				<span className="font-medium text-primary">Pricing</span>
			</div>
			<ContentPricing contentId={id} />
		</div>
	);
}
