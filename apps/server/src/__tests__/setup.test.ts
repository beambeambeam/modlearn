import { describe, expect, it } from "vitest";

describe("Test setup", () => {
	it("should run basic assertions", () => {
		expect(1 + 1).toBe(2);
	});

	it("should have access to globals", () => {
		expect(describe).toBeDefined();
		expect(it).toBeDefined();
		expect(expect).toBeDefined();
	});
});
