import { describe, expect, it } from "vitest";
import { createServerApp } from "@/index";

const OPENAPI_VERSION_PATTERN = /^3\./;

describe("openapi docs", () => {
	it("serves OpenAPI spec JSON", async () => {
		const app = createServerApp();
		const response = await app.handle(
			new Request("http://localhost:3000/docs/openapi.json")
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("application/json");

		const spec = (await response.json()) as {
			openapi: string;
			paths: Record<string, unknown>;
			components?: { securitySchemes?: Record<string, unknown> };
		};

		expect(spec.openapi).toMatch(OPENAPI_VERSION_PATTERN);
		expect(spec.paths["/rpc/content/list"]).toBeDefined();
		expect(spec.paths["/rpc/playback/createSession"]).toBeDefined();
		expect(spec.paths["/rpc/healthCheck"]).toBeDefined();
		expect(spec.components?.securitySchemes?.BearerAuth).toBeDefined();
	});

	it("serves Scalar docs HTML", async () => {
		const app = createServerApp();
		const response = await app.handle(
			new Request("http://localhost:3000/docs")
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/html");

		const html = await response.text();
		expect(html).toContain("@scalar/api-reference");
		expect(html).toContain("/docs/openapi.json");
	});

	it("does not expose new /api procedures", async () => {
		const app = createServerApp();
		const response = await app.handle(
			new Request("http://localhost:3000/api/planets")
		);

		expect(response.status).toBe(404);
	});
});
