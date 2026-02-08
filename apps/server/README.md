# ModLearn API Server

High-performance backend API for the ModLearn educational video streaming platform.

## Overview

This is the server application that powers ModLearn, providing RESTful APIs and real-time capabilities through tRPC.

**Tech Stack:**
- Elysia (TypeScript web framework)
- tRPC (type-safe API layer)
- Better Auth (authentication)
- PostgreSQL + Drizzle ORM (database)
- Bun runtime

## Getting Started

### Prerequisites

- Bun 1.3+
- PostgreSQL database (local or Docker)

### Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# At minimum, update DATABASE_URL and BETTER_AUTH_SECRET
```

### Database Setup

```bash
# Start PostgreSQL (from root)
bun run db:start

# Push schema to database
bun run db:push
```

### Development

```bash
# Start the development server
bun run dev

# Or from root
bun run dev:server
```

The API will be available at `http://localhost:3000`

## Project Structure

```
server/
├── src/
│   ├── index.ts        # Server entry point
│   ├── routes/         # API route handlers
│   └── ...             # Business logic
├── .env.example        # Environment template
└── tsdown.config.ts    # Build configuration
```

## API Architecture

The server uses a layered architecture:

```
Client Request
     ↓
Elysia HTTP Server
     ↓
tRPC Router (type-safe endpoints)
     ↓
Business Logic
     ↓
Drizzle ORM
     ↓
PostgreSQL
```

## Key Features

- **Type-safe APIs**: tRPC ensures type safety between frontend and backend
- **Authentication**: Better Auth provides secure session management
- **Database Access**: Drizzle ORM for type-safe SQL queries
- **Validation**: Built-in request/response validation with Zod
- **Hot Reload**: Fast development with Bun's watch mode

## Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server with hot reload |
| `bun run build` | Build for production |
| `bun run start` | Start production server |
| `bun run check-types` | Check TypeScript types |

## Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/modlearn` |
| `BETTER_AUTH_SECRET` | Yes | Secret for JWT signing | `your-secret-key` |
| `BETTER_AUTH_URL` | Yes | Auth service base URL | `http://localhost:3000` |
| `CORS_ORIGIN` | Yes | Allowed frontend origin | `http://localhost:3001` |

## Authentication

Better Auth is pre-configured in the `packages/auth` workspace. The server exposes auth endpoints at `/api/auth/*`.

### Available Auth Methods

- Email/Password authentication
- Session management
- Password reset
- Email verification

### Protecting Routes

```typescript
import { auth } from '@modlearn/auth';

// In your tRPC router or Elysia route
export const protectedRoute = new Elysia()
  .use(auth)
  .get('/protected', ({ user }) => {
    // Access authenticated user
    return { message: `Hello ${user.email}` };
  });
```

## Database Operations

### Using Drizzle ORM

```typescript
import { db } from '@modlearn/db';
import { courses } from '@modlearn/db/schema';
import { eq } from 'drizzle-orm';

// Query
const allCourses = await db.select().from(courses);

// Insert
const newCourse = await db.insert(courses).values({
  title: 'Introduction to Databases',
  description: 'Learn SQL basics'
}).returning();

// Update
await db.update(courses)
  .set({ title: 'Updated Title' })
  .where(eq(courses.id, courseId));

// Delete
await db.delete(courses).where(eq(courses.id, courseId));
```

### Database Commands Reference

Run these from the project root:

```bash
# Database lifecycle
bun run db:start      # Start PostgreSQL container
bun run db:stop       # Stop PostgreSQL container
bun run db:down       # Remove PostgreSQL container

# Schema management
bun run db:push       # Push schema changes (development)
bun run db:generate   # Generate migration files
bun run db:migrate    # Run pending migrations

# Development tools
bun run db:studio     # Open Drizzle Studio GUI
bun run db:seed       # Run database seeds
```

## Adding tRPC Procedures

Create new API endpoints by adding routers in `packages/api/src/routers/`:

```typescript
// packages/api/src/routers/course.ts
import { z } from 'zod';
import { router, procedure } from '../trpc';

export const courseRouter = router({
  getAll: procedure.query(async () => {
    return await db.select().from(courses);
  }),
  
  getById: procedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await db.query.courses.findFirst({
        where: eq(courses.id, input.id)
      });
    }),
    
  create: procedure
    .input(z.object({
      title: z.string(),
      description: z.string()
    }))
    .mutation(async ({ input }) => {
      return await db.insert(courses).values(input).returning();
    })
});
```

Then register the router in the main app:

```typescript
// packages/api/src/index.ts
import { courseRouter } from './routers/course';

export const appRouter = router({
  course: courseRouter,
  // ... other routers
});
```

## Error Handling

Elysia provides built-in error handling:

```typescript
import { Elysia } from 'elysia';

new Elysia()
  .onError(({ code, error, set }) => {
    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { error: 'Resource not found' };
    }
    
    // Log unexpected errors
    console.error(error);
    
    set.status = 500;
    return { error: 'Internal server error' };
  });
```

## Testing

```bash
# Run tests (when implemented)
bun test
```

## Production Deployment

```bash
# Build the application
bun run build

# Start production server
bun run start
```

## Learn More

- [Elysia Documentation](https://elysiajs.com/)
- [tRPC Documentation](https://trpc.io/docs)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Better Auth](https://www.better-auth.com/)
- [Bun Runtime](https://bun.sh/docs)
