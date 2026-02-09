import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	test: {
		environment: "node",
		include: ["**/*.test.ts", "**/*.spec.ts"],
		exclude: ["**/node_modules/**", "**/dist/**", "**/.turbo/**"],
		setupFiles: ["./src/__tests__/setup.ts"],
		isolate: true,
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			exclude: [
				"**/node_modules/**",
				"**/dist/**",
				"**/*.config.ts",
				"**/*.test.ts",
				"**/*.spec.ts",
			],
		},
		globals: true,
		testTimeout: 10_000,
		hookTimeout: 10_000,
	},
});
