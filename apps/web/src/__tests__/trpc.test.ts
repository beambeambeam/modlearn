import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { trpcClient } from "@/utils/trpc";

const serverUrl = "http://localhost:3000/trpc";

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

it("calls /trpc and returns healthCheck result", async () => {
	const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
		const url = typeof input === "string" ? input : input.toString();
		const parsedUrl = new URL(url);
		expect(`${parsedUrl.origin}${parsedUrl.pathname}`).toBe(
			`${serverUrl}/healthCheck`
		);
		expect(init?.credentials).toBe("include");
		return new Response(
			JSON.stringify([
				{
					id: 0,
					result: { data: "OK" },
				},
			]),
			{
				status: 200,
				headers: { "content-type": "application/json" },
			}
		);
	});

	globalThis.fetch = fetchMock as unknown as typeof fetch;

	const result = await trpcClient.healthCheck.query();

	expect(result).toBe("OK");
	expect(fetchMock).toHaveBeenCalledTimes(1);
});
