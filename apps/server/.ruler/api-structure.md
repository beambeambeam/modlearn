# API Folder Structure for tRPC on Elysia

This document defines the recommended API folder structure for the modlearn server, which uses **tRPC** as the primary API layer running on **Elysia.js** as the HTTP server.

---

## 🚨 Critical Principle

> **tRPC is the MAIN CHARACTER. Elysia is just the HTTP server.**
>
> **ALWAYS use tRPC for your APIs.** Build every endpoint as a tRPC procedure unless it's physically impossible (file uploads, webhooks, SSE, WebSockets).
>
> **95% of your API should be tRPC procedures.** Elysia routes should be rare exceptions.
>
> Before creating an Elysia route, ask: "Can this be a tRPC procedure?" The answer is almost always YES.

---

## Architecture Overview

### tRPC-First Architecture

This project uses **tRPC as the primary API layer** running on Elysia.js as the HTTP server.

**tRPC is the main character** - build ALL your APIs with tRPC by default:
  - All business logic API calls
  - CRUD operations
  - Type-safe client-server communication
  - Input validation with Zod
  - Automatic type inference on the frontend
  - Queries, mutations, and subscriptions
  - Authentication-protected procedures
  - Public and private endpoints

**Elysia.js is the supporting actor** - just the HTTP server that runs tRPC:
  - Provides the HTTP server runtime
  - Handles CORS configuration
  - Serves the `/trpc/*` endpoint via `fetchRequestHandler`
  - Runs Better Auth routes (`/api/auth/*`)
  - Provides middleware capabilities if needed

### When to Use Elysia Routes (Rare Cases)

**ONLY use Elysia routes when tRPC literally cannot handle it:**
- Authentication flows (Better Auth already provides these routes)
- File uploads with multipart form data (tRPC doesn't support this well)
- Webhooks from external services (these need REST endpoints)
- Server-Sent Events (SSE) for real-time streaming
- WebSocket connections (tRPC has experimental support, but Elysia is simpler)

### The Rule: Always Try tRPC First

**Before creating an Elysia route, ask yourself:**
1. Can this be a tRPC procedure? → If yes, use tRPC
2. Does this need to be a REST endpoint? → If no, use tRPC
3. Is this for an external service? → Only then consider Elysia

**95% of your API should be tRPC procedures.** Elysia routes should be rare exceptions.

---

## Folder Structure

```
apps/server/
├── src/
│   ├── index.ts                           # Elysia server entry point
│   │
│   ├── modules/                           # Feature-based modules
│   │   ├── course/
│   │   │   ├── course.router.ts          # tRPC router definition
│   │   │   ├── course.handlers.ts        # tRPC procedure implementations
│   │   │   ├── course.service.ts         # Business logic & database operations
│   │   │   └── course.types.ts           # DTOs, validation schemas, types
│   │   │
│   │   ├── user/
│   │   │   ├── user.router.ts
│   │   │   ├── user.handlers.ts
│   │   │   ├── user.service.ts
│   │   │   └── user.types.ts
│   │   │
│   │   ├── progress/
│   │   │   ├── progress.router.ts
│   │   │   ├── progress.handlers.ts
│   │   │   ├── progress.service.ts
│   │   │   └── progress.types.ts
│   │   │
│   │   └── ... (other domain modules)
│   │
│   ├── trpc/
│   │   ├── index.ts                      # tRPC config (createTRPC, procedures, middleware)
│   │   ├── context.ts                    # Context creation function
│   │   ├── middleware.ts                 # tRPC middleware (auth, logging, etc.)
│   │   └── routers/
│   │       └── index.ts                  # Main app router (composes all modules)
│   │
│   └── utils/                            # Shared utilities
│       ├── errors.ts                     # Custom error classes
│       ├── validation.ts                 # Common Zod schemas
│       └── pagination.ts                 # Pagination helpers
```

### Directory Purposes

- **`modules/`**: Feature-based organization where each module represents a domain entity or feature (course, user, progress)
- **`trpc/`**: tRPC configuration, context creation, middleware, and router composition - **this is where your API lives**
- **`utils/`**: Shared utilities used across multiple modules (error classes, validation helpers, etc.)

---

## Module Organization

### Feature-Based Structure

Each module is organized around a **domain entity** (e.g., course, user, progress) and contains four files:

### 1. `*.router.ts` - tRPC Router Definition

**Purpose:** Defines the public API surface and procedure signatures

**Rules:**
- Import router builder and procedure types from `@/trpc`
- Import handlers from `*.handlers.ts`
- Import validation schemas from `*.types.ts`
- Define procedures with explicit input validation
- Use `query` for read operations, `mutation` for write operations
- Use `publicProcedure` for unauthenticated access, `protectedProcedure` for authenticated

**Structure:**
- Export a single router named `{entity}Router`
- Group related procedures together (list, getById, create, update, delete)
- Always chain `.input()` for validation before `.query()` or `.mutation()`

### 2. `*.handlers.ts` - Procedure Implementations

**Purpose:** Contains the actual logic for each procedure

**Rules:**
- Each handler is an async function that receives `{ input, ctx }`
- Type the input and context explicitly
- Call service functions for business logic
- Handle errors with TRPCError (NOT regular Error)
- Return data directly (no wrapping in response objects)
- Keep handlers thin - delegate to services

**Structure:**
- Export named functions matching router procedure names
- One handler per procedure
- Import service functions from `*.service.ts`
- Import types from `*.types.ts`

### 3. `*.service.ts` - Business Logic & Database Operations

**Purpose:** Pure TypeScript functions that encapsulate business logic and database operations

**Rules:**
- All database operations go through services
- Services are **pure functions** (not classes)
- Each function should have a single responsibility
- Use Drizzle ORM for database operations
- Return data directly from database queries
- Throw plain Error objects (handlers will convert to TRPCError)
- Services can import other services for cross-module operations

**Structure:**
- Export named functions like `findX`, `createX`, `updateX`, `deleteX`
- Group related operations together
- Use descriptive names (findCourseById, not getCourse)
- Accept typed parameters from `*.types.ts`

### 4. `*.types.ts` - Types & Validation Schemas

**Purpose:** DTOs, Zod schemas, and TypeScript types for the module

**Rules:**
- Define all Zod schemas in this file
- Export both schemas and inferred types
- Use descriptive names ending with `Input` (e.g., `createCourseInput`)
- Use `z.infer<typeof schema>` to generate TypeScript types
- Co-locate related schemas (list, get, create, update, delete)

**Structure:**
- Define Zod schemas first
- Export schema constants
- Export inferred types below schemas
- Use consistent naming: `{action}{Entity}Input` and `{Action}{Entity}Input` type

---

## tRPC Router Patterns

### Router Composition

**Rule:** The main app router composes all module routers

**Location:** `trpc/routers/index.ts`

**Structure:**
- Import all module routers
- Compose into `appRouter` using `router()` builder
- Export `appRouter` as default
- **ALWAYS export `AppRouter` type** for client consumption

**Naming:** Use domain names as keys (course, user, progress, NOT courses, users, progresses)

### Procedure Types

Use two main procedure types:

**Public Procedures:**
- Available to all users (authenticated or not)
- No user context guarantee
- Must check `ctx.user` if needed
- Export as `publicProcedure` from `trpc/index.ts`

**Protected Procedures:**
- Require authentication
- Guarantee `ctx.user` exists
- Throw UNAUTHORIZED if no user
- Export as `protectedProcedure` from `trpc/index.ts`

### Custom Middleware

**Rule:** Create custom procedures for specific concerns

**Pattern:**
- Use `.use()` to chain middleware onto base procedures
- Create specialized procedures (adminProcedure, rateLimitedProcedure, etc.)
- Export from `trpc/index.ts` for reuse across modules
- Middleware can modify context or throw errors

**Common Middleware:**
- Admin-only access
- Rate limiting
- Logging
- Performance tracking
- Feature flags

### Input Validation

**MANDATORY:** Always validate inputs with Zod schemas

**Rules:**
- Never skip `.input()` validation
- Use schemas from `*.types.ts`
- Let Zod throw BAD_REQUEST automatically
- Validation happens before handler execution

**Bad Practice:** Creating procedures without `.input()` validation

### Error Handling

**Rule:** Use TRPCError with appropriate codes

**Error Codes:**
- `BAD_REQUEST` - Invalid input (Zod handles this automatically)
- `UNAUTHORIZED` - Not authenticated
- `FORBIDDEN` - Authenticated but lacks permission
- `NOT_FOUND` - Resource doesn't exist
- `CONFLICT` - Resource already exists
- `INTERNAL_SERVER_ERROR` - Unexpected errors
- `TOO_MANY_REQUESTS` - Rate limit exceeded

**Structure:**
- Throw TRPCError in handlers, NOT services
- Include descriptive messages
- Services throw plain Error, handlers convert to TRPCError

---

## Service Layer

### Purpose

The service layer encapsulates:
- Database operations (via Drizzle ORM)
- Business logic
- Data transformations
- External API calls
- Reusable functions across multiple routers

### Service Functions

**Rules:**
- Services are **pure TypeScript functions** (NOT classes)
- Each function has a single, clear purpose
- All database operations must go through services
- Services can call other services
- Return data directly, don't wrap in response objects
- Throw plain Error objects (handlers will convert to TRPCError)

**Naming Conventions:**
- `find{Entity}` - Query operations
- `create{Entity}` - Insert operations
- `update{Entity}` - Update operations
- `delete{Entity}` - Delete operations
- `validate{Something}` - Validation logic
- `calculate{Something}` - Computation logic

### Cross-Module Service Usage

**Rule:** Services can import and use other module services

**Pattern:**
- Import service functions with `* as {module}Service`
- Use namespaced imports to avoid naming conflicts
- Validate cross-module references (e.g., check user exists before creating course)

### Transaction Handling

**Rule:** Use Drizzle transactions for multi-step operations

**Pattern:**
- Wrap related operations in `db.transaction()`
- Transaction callback receives `tx` instead of `db`
- All operations in transaction must succeed or all fail
- Return final result from transaction

**Use Cases:**
- Creating related records (enrollment + progress)
- Updating multiple tables atomically
- Complex business logic requiring consistency

---

## Type Safety

### Exporting Router Types

**MANDATORY:** Always export `AppRouter` type from `trpc/routers/index.ts`

**Rule:** Export `type AppRouter = typeof appRouter`

**Purpose:** Enables full type-safety on the client side

### Client-Side Type Safety

**Pattern:** Web app imports `AppRouter` type for tRPC client setup

**Result:** Full end-to-end type inference from server to client

### Type Inference from Zod

**Rule:** Use `z.infer<typeof schema>` to derive TypeScript types

**Pattern:**
- Define Zod schema
- Export schema constant
- Export inferred type: `export type X = z.infer<typeof xSchema>`

**Benefit:** Single source of truth - runtime validation + compile-time types

### Shared Types

**Rule:** Export shared types from `packages/api` for use in both server and web app

**Pattern:**
- DTOs that are used in multiple places
- Domain model interfaces
- Response shapes
- Avoid duplicating type definitions

---

## Context & Middleware

### Context Creation

**Location:** `trpc/context.ts`

**Purpose:** Provides request-scoped data to all procedures

**Rules:**
- Create context function receives fetch request options
- Extract authentication from headers using Better Auth
- Return object with user, session, and other request-scoped data
- Export context type for use in handlers

**Structure:**
- `user`: Authenticated user or null
- `session`: Session object or null
- `headers`: Request headers
- Add other request-scoped data as needed

### Using Context in Handlers

**Rule:** Access context via `ctx` parameter in handlers

**Pattern:**
- All handlers receive `{ input, ctx }`
- Type context explicitly as `Context` from `trpc/context`
- Check `ctx.user` for authentication status
- Use `ctx` for request-scoped data (user, session, etc.)

### tRPC Middleware

**IMPORTANT:** Use tRPC middleware for all API logic, NOT Elysia middleware

**Location:** `trpc/middleware.ts`

**Common Middleware:**
- Logging (log procedure calls and duration)
- Rate limiting (check request limits)
- Admin checks (verify admin role)
- Feature flags (check enabled features)
- Performance tracking
- Error reporting

**Pattern:**
- Create middleware with `t.middleware()`
- Chain middleware with `.use()`
- Middleware can modify context or throw errors
- Apply globally or to specific procedures

---

## Best Practices

### tRPC-First Principle

**ALWAYS use tRPC unless you absolutely cannot:**

✅ **Use tRPC for:**
- All CRUD operations
- All business logic APIs
- Public and protected endpoints
- Real-time queries (use polling or subscriptions)
- File downloads (return base64 or signed URLs)
- Any API your web app calls

❌ **Only use Elysia routes for:**
- Better Auth routes (already provided)
- File uploads with multipart form data
- Webhooks from external services (Stripe, GitHub, etc.)
- Server-Sent Events (SSE)
- WebSocket connections

**If you're about to create an Elysia route, stop and ask: "Can this be a tRPC procedure?"**

The answer is almost always YES. tRPC should be your default choice for 95% of all APIs.

### File Naming Conventions

- **Module files**: `{entity}.{type}.ts` (e.g., `course.router.ts`, `user.service.ts`)
- **Module folders**: Singular entity name (e.g., `course/`, not `courses/`)
- **Utility files**: Descriptive lowercase (e.g., `errors.ts`, `pagination.ts`)

### Import Organization

Order imports from least to most specific:

1. External packages (zod, @trpc/server)
2. Workspace packages (@repo/db, @repo/auth)
3. Project-level imports (@/trpc, @/utils)
4. Module-level imports (./course.handlers, ./course.types)

### Code Organization Principles

1. **Single Responsibility**: Each file has one clear purpose
2. **Separation of Concerns**: Router → Handler → Service → Database
3. **DRY (Don't Repeat Yourself)**: Extract common logic into services/utils
4. **Type Safety**: Use Zod for runtime validation, TypeScript for compile-time safety
5. **Explicit over Implicit**: Clear naming, explicit types when helpful

### Router Organization

**Good ✅ - Organized by domain:**
- Group procedures into domain routers
- Each router represents a cohesive feature or entity
- Compose routers into main app router

**Bad ❌ - Flat structure:**
- All procedures in one giant router
- No logical grouping
- Difficult to maintain and navigate

### Handler Extraction

**Good ✅ - Extracted handlers:**
- Handlers in separate file
- One handler per procedure
- Easy to test and maintain

**Bad ❌ - Inline handlers:**
- Logic directly in router definition
- Difficult to test
- Violates separation of concerns

---

## Migration Guide

### From Current Structure

Current minimal structure:
```
src/
├── index.ts
└── trpc/
    └── routers/
        └── index.ts
```

### Migration Steps

**Step 1: Create the modules directory**
- Run: `mkdir -p src/modules`

**Step 2: Extract first module**
- Create module folder: `mkdir -p src/modules/{entity}`
- Create four files: `{entity}.types.ts`, `{entity}.service.ts`, `{entity}.handlers.ts`, `{entity}.router.ts`
- Move existing procedures to new structure

**Step 3: Update main router**
- Import module router
- Add to app router composition
- Test endpoint still works

**Step 4: Migrate incrementally**
- Don't migrate everything at once
- Start with simplest domain
- Test thoroughly after each module
- Update client imports progressively
- Keep old and new coexisting during migration

---

## Summary

### The Golden Rule

**tRPC is the main character. Elysia is just the server.**

Build ALL your APIs with tRPC unless it's physically impossible. Elysia routes should be rare exceptions (auth, file uploads, webhooks, SSE, WebSockets).

### This Structure Provides

✅ **tRPC-First Architecture** - 95% of your API should be tRPC procedures
✅ **Scalability** - Organized by domain, easy to add new features
✅ **Separation of Concerns** - Router → Handler → Service layers
✅ **Type Safety** - Full end-to-end type inference
✅ **Testability** - Pure functions in service layer
✅ **Maintainability** - Clear conventions and patterns
✅ **Flexibility** - Easy to refactor and reorganize

### Quick Checklist

Before writing any API code, ask:

1. ✅ **Is this a tRPC procedure?** → Default answer: YES
2. ❌ **Does this need to be an Elysia route?** → Only if:
   - File upload with multipart form data
   - External webhook endpoint
   - SSE or WebSocket connection
   - Already provided by Better Auth

**When in doubt, use tRPC.** It's the main character of your API layer.
