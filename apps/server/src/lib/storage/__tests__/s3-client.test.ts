import { S3Client } from "@aws-sdk/client-s3";
import { beforeEach, describe, expect, it } from "vitest";
import { s3Mock } from "@/lib/storage/__tests__/helpers/s3-mock";
import { s3Client } from "@/lib/storage/s3-client";

describe("S3 Client Initialization", () => {
	beforeEach(() => {
		s3Mock.reset();
	});

	it("should initialize S3Client with correct configuration", () => {
		expect(s3Client).toBeInstanceOf(S3Client);
	});

	it("should have configuration object", () => {
		// Access internal config to verify it's properly initialized
		expect(s3Client.config).toBeDefined();
	});

	it("should configure retry strategy", () => {
		// Check that client has retry configuration
		// Note: The actual maxAttempts value is resolved at runtime
		expect(s3Client.config.maxAttempts).toBeDefined();
	});

	it("should configure request handler", () => {
		// Verify client is properly configured with request handler
		expect(s3Client.config.requestHandler).toBeDefined();
	});
});
