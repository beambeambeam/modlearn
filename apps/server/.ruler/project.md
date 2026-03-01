# Project Rules

## Imports

- Always use `@`-prefixed aliases for internal imports.
- Avoid relative imports for cross-folder server modules.

## Server Structure

- Keep module shape consistent: `*.service.ts`, `*.types.ts`, `*.validators.ts`, optional `*.utils.ts`.
- Do not introduce `*.handlers.ts` as an extra layer unless explicitly required.

## Router Conventions

- Keep tRPC router files thin.
- Centralize TRPC error mapping helpers in `src/trpc/routers/router.utils.ts`.
- Keep tRPC context input types in `src/trpc/context.types.ts`.
