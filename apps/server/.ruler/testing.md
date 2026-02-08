# Testing Strategy

## Non-Negotiable TDD Workflow

Follow the TDD rules in this folder for all server behavior changes:

- Write a failing test first.
- Verify the failure is expected (not a setup error).
- Implement the smallest change to pass.
- Refactor only after all tests are green.

If you cannot follow TDD, stop and ask.

## Test Runner And File Layout

The server uses Bun's built-in test runner.

- Place tests in files matching `*.test.ts` or `*.spec.ts`.
- Prefer a `tests/` or `__tests__/` folder close to the code under test.
- Use `beforeEach` / `afterEach` for isolation when shared resources exist.
- Avoid `test.concurrent` unless the test is fully isolated and stateless.
- Use `bun test --randomize` occasionally to detect hidden ordering dependencies.

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
