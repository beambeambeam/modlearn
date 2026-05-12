import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import Logo from "@/components/logo";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/")({
	component: HomeComponent,
});

function HomeComponent() {
	const healthCheck = useQuery(orpc.healthCheck.queryOptions());

	return (
		<div className="flex min-h-full items-center justify-center px-6">
			<div className="flex w-full max-w-4xl flex-col items-center gap-6 py-12">
				<Logo
					alt="Modlearn"
					className="h-auto w-full max-w-lg"
					fetchPriority="high"
					loading="eager"
					variant="with-name"
				/>
				<p className="text-center text-muted-foreground text-sm">
					{healthCheck.data}
				</p>
			</div>
		</div>
	);
}
