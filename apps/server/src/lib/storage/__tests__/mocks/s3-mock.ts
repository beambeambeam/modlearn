import { S3Client } from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";

/**
 * Shared S3 Client Mock
 *
 * This mock is used across all S3 operation tests.
 * Import and reset in beforeEach() to ensure test isolation.
 *
 * Example:
 * ```typescript
 * import { s3Mock } from './mocks/s3-mock';
 *
 * beforeEach(() => {
 *   s3Mock.reset();
 * });
 * ```
 */
export const s3Mock = mockClient(S3Client);
