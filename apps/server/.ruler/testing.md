# Testing Strategy

## Non-Negotiable TDD Workflow

Follow the TDD rules in this folder for all server behavior changes:

- Write a failing test first.
- Verify the failure is expected (not a setup error).
- Implement the smallest change to pass.
- Refactor only after all tests are green.

If you cannot follow TDD, stop and ask.

## Test Runner And File Layout

The server uses Vitest as the test runner.

- Place tests in files matching `*.test.ts` or `*.spec.ts`.
- Prefer a `tests/` or `__tests__/` folder close to the code under test.
- Use `beforeEach` / `afterEach` for isolation when shared resources exist.
- Vitest runs tests in isolated environments by default (configured in vitest.config.ts).
- Use `vitest run --sequence.shuffle` occasionally to detect hidden ordering dependencies.

### Vitest Features Available

- **describe**: Group related tests together
- **it / test**: Define individual test cases
- **expect**: Assertions (expect(value).toBe(expected))
- **vi.fn()**: Create mock functions
- **vi.mock()**: Mock modules (use sparingly, prefer dependency injection)
- **beforeEach / afterEach**: Setup and teardown per test
- **beforeAll / afterAll**: Setup and teardown per suite

### Running Tests

- `bun run test` - Run all tests once
- `bun run test:watch` - Watch mode (rerun on changes)
- `bun run test:ui` - Interactive browser UI
- `bun run test:coverage` - Generate coverage report

## tRPC Procedure Testing (Router Layer)

Test procedures through the router caller so middleware, input validation, and context run exactly as production.

Guidelines:

- Use `router.createCaller(ctx)` or `t.createCallerFactory(appRouter)`.
- Build a full context object that matches the real shape.
- Treat each procedure test as a unit test for the router layer.
- For errors, assert on the `TRPCError` code and message shape, not stack traces.
- For protected procedures, assert `UNAUTHORIZED` when the session is missing.

Suggested outline:

```
// arrange: ctx, caller
// act: await caller.router.procedure(input)
// assert: data or TRPCError
```

## Context Construction And Better Auth Sessions

The production context is built from `auth.api.getSession` and stored as `ctx.session`.
Tests must provide a real-shaped `ctx.session` or a null session depending on intent.

Recommended approach:

- Create a shared `makeTestContext()` helper that returns `{ session }`.
- Provide a default `session: null` and explicit session overrides per test.
- When testing authorization, use two explicit fixtures:
	- `session: null` to assert `UNAUTHORIZED`.
	- `session: { user: { ... } }` to assert protected access.

Avoid mocking tRPC internals. If you must stub session creation, stub only `auth.api.getSession` at the boundary and return a consistent session object.

## Database Mocking And Boundaries

Mock the database at the lowest boundary you own. Avoid mocking query builders or ORM internals.

Unit tests:

- Prefer deterministic stubs for repository or service dependencies.
- Mock only the methods used by the test.
- Keep mocks explicit and local to the test file.

Integration tests:

- Use a real test database with clean state per test or per suite.
- Use deterministic seed data when needed.
- Clean up data in `afterEach` / `afterAll` to avoid cross-test contamination.

## Test Database (PGlite)

Integration tests use an in-memory Postgres database via PGlite. Use the shared helpers to keep setup consistent:

- Create and teardown a DB instance with `createTestDatabase()` from [src/__tests__/helpers/test-db.ts](src/__tests__/helpers/test-db.ts).
- Reset tables between tests with `resetTestDatabase()` in the same helper file.
- Use factory helpers in [src/__tests__/helpers/factories.ts](src/__tests__/helpers/factories.ts) to create users and sessions.
- Migrations are loaded from [packages/db/src/migrations](packages/db/src/migrations); if you add migrations, tests should pick them up automatically.

## Service Layer Testing

Service functions are tested without tRPC.

- Inject dependencies (db, clock, cache) so tests can replace them.
- Assert both returned data and side effects (writes, calls).
- Use domain-level inputs and outputs, not transport-level types.
- Keep one behavior per test to preserve TDD clarity.

## Integration Tests (In-Process)

Integration tests validate the router and services together without HTTP.

- Use `createCaller` with a real context.
- Avoid network calls and HTTP adapters for these tests.
- Verify behavior across layers: router -> service -> db.

## What Not To Do

- Do not write production code before a failing test exists.
- Do not test unit behavior through HTTP.
- Do not depend on test order or shared mutable state.
- Do not leave console output in tests.
