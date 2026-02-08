import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
	// @ts-expect-error - Vite plugin type mismatch between vitest and vite versions
	plugins: [tsconfigPaths()],
	test: {
		environment: "node",
		include: ["**/*.test.ts", "**/*.spec.ts"],
		exclude: ["**/node_modules/**", "**/dist/**", "**/.turbo/**"],
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
			// Coverage thresholds - currently disabled for initial setup
			// thresholds: {
			// 	lines: 80,
			// 	functions: 80,
			// 	branches: 80,
			// 	statements: 80,
			// },
		},
		globals: true,
		testTimeout: 10_000,
		hookTimeout: 10_000,
	},
});
