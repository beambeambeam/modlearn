import { createFileRoute } from "@tanstack/react-router";
import ContentPricing from "@/components/admin/content/content-pricing";

export const Route = createFileRoute("/_admin-layout/admin/content/$id/pricing")({
  component: ContentPricingPage,
});

function ContentPricingPage() {
  const { id } = Route.useParams();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Content</span>
        <span>{">"}</span>
        <button
          type="button"
          className="hover:text-foreground cursor-pointer"
          onClick={() => history.back()}
        >
          Edit Content
        </button>
        <span>{">"}</span>
        <span className="text-primary font-medium">Pricing</span>
      </div>
      <ContentPricing contentId={id} />
    </div>
  );
}