import { db } from "@modlearn/db";
// biome-ignore lint/performance/noNamespaceImport: Import all for the adapater
import * as schema from "@modlearn/db/schema/auth";
import { env } from "@modlearn/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin as adminPlugin, username } from "better-auth/plugins";
import { ac, roles } from "./roles";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",

		schema,
	}),
	trustedOrigins: [env.CORS_ORIGIN],
	emailAndPassword: {
		enabled: true,
	},
	advanced: {
		defaultCookieAttributes: {
			sameSite: "none",
			secure: true,
			httpOnly: true,
		},
	},
	plugins: [
		username(),
		adminPlugin({
			defaultRole: "user",
			adminRoles: ["admin", "superadmin"],
			ac,
			roles,
		}),
	],
});
