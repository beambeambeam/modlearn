# API Structure (Server)

This document defines the current server API structure for `apps/server`.

## Core Principle

- tRPC is the primary API layer.
- Elysia is the HTTP host/runtime.
- Prefer tRPC procedures for all internal app APIs.
- Use raw Elysia routes only for exceptional cases (multipart upload endpoints, external webhooks, SSE/WebSocket if needed).

## Current Folder Structure

```text
apps/server/src/
├── modules/
│   ├── category/
│   │   ├── category.service.ts
│   │   ├── category.types.ts
│   │   ├── category.validators.ts
│   │   └── category.utils.ts
│   ├── genre/
│   │   ├── genre.service.ts
│   │   ├── genre.types.ts
│   │   ├── genre.validators.ts
│   │   └── genre.utils.ts
│   ├── content/
│   │   ├── content.service.ts
│   │   ├── content.types.ts
│   │   ├── content.validators.ts
│   │   └── content.utils.ts
│   ├── playlist/
│   │   ├── playlist.service.ts
│   │   ├── playlist.types.ts
│   │   ├── playlist.validators.ts
│   │   └── playlist.utils.ts
│   ├── file/
│   │   ├── file.service.ts
│   │   ├── file.types.ts
│   │   └── file.validators.ts
│   └── admin-audit/
│       ├── admin-audit.service.ts
│       └── admin-audit.types.ts
├── trpc/
│   ├── context.ts
│   ├── context.types.ts
│   ├── index.ts
│   └── routers/
│       ├── index.ts
│       ├── _audit.ts
│       ├── _audit.types.ts
│       ├── router.utils.ts
│       ├── category.router.ts
│       ├── genre.router.ts
│       ├── content.router.ts
│       ├── playlist.router.ts
│       └── file.router.ts
└── index.ts
```

## Module Responsibilities

### `*.validators.ts`
- Owns Zod schemas and input validation rules.
- Router `.input(...)` should use these schemas.

### `*.types.ts`
- Owns module-specific TypeScript interfaces/types and domain errors.
- Service parameter/result types live here.

### `*.utils.ts`
- Owns pure helper functions.
- No side effects and no DB write/query behavior.
- Keep helpers local to module unless truly shared.

### `*.service.ts`
- Owns business logic and DB operations.
- Accepts typed params from module `*.types.ts`.
- Can use module `*.utils.ts` and validators-derived inputs.

## tRPC Layer Responsibilities

### `trpc/routers/*.router.ts`
- Defines public/admin procedures.
- Calls service functions.
- Converts domain/service errors to `TRPCError` using shared helpers.

### `trpc/routers/router.utils.ts`
- Central place for router error mappers (`mapCategoryError`, `mapGenreError`, etc.).
- Keep mapping logic consistent across routers.

### `trpc/context.ts` and `trpc/context.types.ts`
- `context.types.ts` defines context input types.
- `context.ts` builds runtime context (`db`, `session`, ...).

## Rules

1. Use `@/...` path aliases for internal imports.
2. Do not add `*.handlers.ts` files for normal server modules.
3. Keep routers thin: validation + procedure wiring + error mapping.
4. Keep services focused on business logic and persistence.
5. Put reusable pure helpers in module `*.utils.ts`.
6. Use shared router mapping helpers from `trpc/routers/router.utils.ts`.
7. Keep function signatures and API behavior stable during refactors unless explicitly requested.

## Testing Expectations

After structural refactors, run:

1. `bun run check-types`
2. `bun run test:server`
3. `bun x ultracite check`

All must pass before merge.
