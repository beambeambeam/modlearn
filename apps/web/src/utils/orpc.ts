import { env } from "@modlearn/env/web";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import type { AppRouter } from "server/orpc/router";
import { toast } from "sonner";

export const queryClient = new QueryClient({
	queryCache: new QueryCache({
		onError: (error, query) => {
			toast.error(error.message, {
				action: {
					label: "retry",
					onClick: query.invalidate,
				},
			});
		},
	}),
});

export const orpcClient: RouterClient<AppRouter> = createORPCClient(
	new RPCLink({
		url: `${env.VITE_SERVER_URL}/rpc`,
		fetch: (input: RequestInfo | URL, init?: RequestInit) => {
			return fetch(input, {
				...init,
				credentials: "include",
			});
		},
	})
);

export const orpc = createTanstackQueryUtils(orpcClient);
