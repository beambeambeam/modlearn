# Validation Patterns (Server)

This document defines server-side validation rules for the ModLearn backend. It applies to tRPC procedures and any rare Elysia routes.

---

## Scope

- Server-only validation (tRPC/Elysia). Client-side checks are for UX only.
- All user-controlled or untrusted inputs must be validated at the server boundary.
- Validation happens before business logic and database access.

---

## Rule 1: Always validate inputs

- Every tRPC procedure MUST define `.input()` with a Zod schema. No exceptions.
- Elysia routes MUST validate request body, params, and query with Zod before use.
- Treat all external inputs as untrusted: headers, params, query, body, webhooks, and auth claims.

---

## Rule 2: Reusable Zod schemas live in one place

- Module-specific schemas belong in `*.types.ts` inside each module (see API structure).
- Cross-module, shared validators belong in `src/utils/validation.ts` (or a dedicated shared module if/when created).
- Export the schema and its inferred type; use the schema as the single source of truth.

---

## Rule 3: Common validators are standardized

Use standardized validators for recurring fields:

- Email: apply a strict format check and length limits.
- UUID: validate UUID format consistently.
- Pagination: enforce numeric bounds, sensible defaults, and a maximum page size cap.
- Identifiers: do not allow arbitrary strings where IDs are expected.
- Enum-like fields: use allowlists, never denylist patterns.

---

## Rule 4: Schema composition, not duplication

Compose schemas using Zod features rather than re-implementing:

- Prefer composition with `merge`, `extend`, `pick`, `omit`, and `partial`.
- Use shared base schemas for common fields (e.g., pagination, date ranges, filters).
- Keep schemas narrow and purpose-specific; compose for larger inputs.

---

## Rule 5: Custom validation errors are consistent

- Validation errors should be clear, stable, and user-safe.
- Use Zod's error customization or refinement to express business rules.
- Convert validation failures to `TRPCError` with `BAD_REQUEST` at the handler boundary.
- Service layer throws plain `Error`; handlers map to `TRPCError`.

---

## Rule 6: Syntactic and semantic validation both matter

- Syntactic validation checks shape and format (e.g., string length, uuid format).
- Semantic validation enforces business rules (e.g., start date before end date).
- Perform semantic checks in handlers or services after basic schema validation.

---

## Rule 7: Allowlist over denylist

- Allowlist validation is the default for strings, enums, and free-form inputs.
- Denylists may be used only as a supplemental layer, never as the primary check.
- Use explicit length limits for all user-provided strings.

---

## Rule 8: Validate at the boundary

- Do not pass unvalidated data into services or database calls.
- Validate once at the edge; do not re-parse inside lower layers unless data is re-entering from another untrusted source.

---

## References (Best Practices)

- Zod documentation: https://zod.dev/
- tRPC input validators: https://trpc.io/docs/server/validators
- OWASP Input Validation Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
