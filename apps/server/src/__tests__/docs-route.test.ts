import { describe, expect, it, vi } from "vitest";

vi.mock("trpc-docs-generator", () => ({
	collectRoutes: () => [],
	generateDocsHtml: () => "<html>docs</html>",
}));

import { createServerApp, docsHtml } from "../index";

describe("docs route", () => {
	it("returns HTML content with the correct headers", async () => {
		const app = createServerApp();
		const response = await app.handle(new Request("http://localhost/docs"));
		const contentType = response.headers.get("content-type");
		expect(contentType).toContain("text/html");
		const body = await response.text();
		expect(body).toBe(docsHtml);
	});
});
