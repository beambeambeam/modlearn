import { resolve } from "node:path";
import { config } from "dotenv";

/**
 * Test Environment Setup
 *
 * This file runs BEFORE all test files to configure the test environment.
 * It loads .env.test from the project root.
 *
 * IMPORTANT: This code runs at module load time (before beforeAll/beforeEach)
 * to ensure environment variables are available when modules import @modlearn/env.
 */

// Load .env.test from project root
config({ path: resolve(__dirname, "../../../../.env.test") });
