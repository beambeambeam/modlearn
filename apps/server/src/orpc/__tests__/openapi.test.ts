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
		expect(spec.paths["/rpc/course/list"]).toBeDefined();
		expect(spec.paths["/rpc/content/list"]).toBeUndefined();
		expect(spec.paths["/rpc/playlist/list"]).toBeUndefined();
		expect(spec.paths["/rpc/commerce/cart/addItem"]).toBeUndefined();
		expect(spec.paths["/rpc/commerce/cart/removeItem"]).toBeUndefined();
		expect(spec.paths["/rpc/commerce/cart/list"]).toBeUndefined();
		expect(spec.paths["/rpc/commerce/checkout/createOrder"]).toBeUndefined();
		expect(spec.paths["/rpc/playback/createSession"]).toBeUndefined();
		expect(spec.paths["/rpc/healthCheck"]).toBeDefined();
		expect(spec.components?.securitySchemes?.BearerAuth).toBeDefined();
	});

	it("includes declared oRPC error responses with default HTTP mappings", async () => {
		const app = createServerApp();
		const response = await app.handle(
			new Request("http://localhost:3000/docs/openapi.json")
		);
		const spec = (await response.json()) as {
			paths: Record<
				string,
				{
					post?: {
						responses?: Record<
							string,
							{
								content?: {
									"application/json"?: {
										schema?: {
											oneOf?: Array<{
												properties?: Record<string, { const?: unknown }>;
											}>;
										};
									};
								};
							}
						>;
					};
				}
			>;
		};

		const getByIdResponses =
			spec.paths["/rpc/category/getById"]?.post?.responses ?? {};
		const upsertMineResponses =
			spec.paths["/rpc/review/upsertMine"]?.post?.responses ?? {};

		expect(getByIdResponses["404"]).toBeDefined();
		expect(getByIdResponses["500"]).toBeDefined();
		expect(upsertMineResponses["401"]).toBeDefined();
		expect(upsertMineResponses["403"]).toBeDefined();

		const definedNotFoundSchema =
			getByIdResponses["404"]?.content?.["application/json"]?.schema
				?.oneOf?.[0];
		const definedForbiddenSchema =
			upsertMineResponses["403"]?.content?.["application/json"]?.schema
				?.oneOf?.[0];

		expect(definedNotFoundSchema?.properties?.code?.const).toBe("NOT_FOUND");
		expect(definedNotFoundSchema?.properties?.status?.const).toBe(404);
		expect(definedForbiddenSchema?.properties?.code?.const).toBe("FORBIDDEN");
		expect(definedForbiddenSchema?.properties?.status?.const).toBe(403);
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
