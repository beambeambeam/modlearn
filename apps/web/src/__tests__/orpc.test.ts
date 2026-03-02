import { afterEach, beforeEach, expect, it, vi } from "vitest";

const serverUrl = "http://localhost:3000/rpc";

let originalFetch: typeof fetch | undefined;

beforeEach(() => {
	originalFetch = globalThis.fetch;
});

afterEach(() => {
	if (originalFetch) {
		globalThis.fetch = originalFetch;
	}
	vi.restoreAllMocks();
});

it("calls /rpc and returns healthCheck result", async () => {
	process.env.VITE_SERVER_URL = "http://localhost:3000";
	const { orpcClient } = await import("@/utils/orpc");

	const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
		let url: string;
		if (typeof input === "string") {
			url = input;
		} else if (input instanceof URL) {
			url = input.toString();
		} else {
			url = input.url;
		}
		const parsedUrl = new URL(url);
		expect(`${parsedUrl.origin}${parsedUrl.pathname}`).toBe(
			`${serverUrl}/healthCheck`
		);
		expect(init?.credentials).toBe("include");
		return new Response(JSON.stringify({ json: "OK" }), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	});

	globalThis.fetch = fetchMock as unknown as typeof fetch;

	const result = await orpcClient.healthCheck();
	expect(result).toBe("OK");
	expect(fetchMock).toHaveBeenCalledTimes(1);
});
