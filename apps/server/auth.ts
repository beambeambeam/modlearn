import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = resolve(__dirname, ".env");

dotenv.config({
	path: envPath,
	override: true,
});

const authModule = (await import("./src/lib/auth/index")) as { auth: unknown };

export const auth = authModule.auth;
