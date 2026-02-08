import { ac, roles } from "@modlearn/auth/roles";
import { env } from "@modlearn/env/web";
import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	baseURL: env.VITE_SERVER_URL,
	plugins: [
		adminClient({
			ac,
			roles,
		}),
	],
});
