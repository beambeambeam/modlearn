# ModLearn Web Frontend

React-based frontend application for the ModLearn educational video streaming platform.

## Overview

This is the web client for ModLearn, built with modern React patterns and optimized for performance.

**Tech Stack:**
- React 19
- TanStack Router (file-based routing)
- tRPC Client (type-safe API calls)
- Vite (fast development and building)
- Tailwind CSS (utility-first styling)
- shadcn/ui (accessible UI components)

## Getting Started

### Prerequisites

- Node.js 18+ or Bun 1.3+
- Backend server running (see `apps/server/`)

### Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env if needed (usually works with defaults)
```

### Development

```bash
# Start the development server
bun run dev

# Or from root
bun run dev:web
```

The app will be available at `http://localhost:3001`

## Project Structure

```
web/
├── src/
│   ├── components/     # Reusable UI components
│   │   └── ui/         # shadcn/ui components
│   ├── routes/         # TanStack Router file-based routes
│   │   ├── __root.tsx  # Root layout
│   │   ├── index.tsx   # Home page
│   │   └── ...         # Other routes
│   ├── lib/
│   │   ├── auth-client.ts   # Better Auth client
│   │   └── utils.ts         # Utility functions
│   ├── utils/
│   │   └── trpc.ts     # tRPC client setup
│   ├── styles/         # Global styles
│   └── main.tsx        # App entry point
├── public/             # Static assets
├── .env.example        # Environment template
├── index.html          # HTML entry
└── vite.config.ts      # Vite configuration
```

## Key Features

- **File-based Routing**: Routes are automatically generated from files in `src/routes/`
- **Type-safe API**: tRPC provides end-to-end type safety with the backend
- **Authentication**: Integrated with Better Auth for secure session management
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Fast Refresh**: Instant feedback during development with Vite HMR

## Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server |
| `bun run build` | Build for production |
| `bun run preview` | Preview production build |
| `bun run check-types` | Check TypeScript types |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_SERVER_URL` | Backend API URL | `http://localhost:3000` |

## Route Conventions

TanStack Router uses file-based routing:

- `src/routes/index.tsx` → `/`
- `src/routes/about.tsx` → `/about`
- `src/routes/courses/index.tsx` → `/courses`
- `src/routes/courses/$courseId.tsx` → `/courses/:courseId`
- `src/routes/courses/-layout.tsx` → Layout wrapper for `/courses/*`

See [TanStack Router docs](https://tanstack.com/router/latest) for more.

## Connecting to Backend

The frontend uses tRPC to communicate with the backend:

```typescript
import { trpc } from '@/utils/trpc';

function MyComponent() {
  const { data, isLoading } = trpc.course.getAll.useQuery();
  
  if (isLoading) return <div>Loading...</div>;
  
  return <div>{data?.map(course => <CourseCard key={course.id} {...course} />)}</div>;
}
```

## Authentication

Better Auth client is pre-configured in `src/lib/auth-client.ts`:

```typescript
import { authClient } from '@/lib/auth-client';

// Sign in
await authClient.signIn.email({
  email: 'user@example.com',
  password: 'password'
});

// Sign out
await authClient.signOut();

// Get session
const session = await authClient.getSession();
```

## Adding UI Components

This project uses shadcn/ui components. To add new components:

```bash
# Add a component (from project root)
bunx shadcn@latest add button
```

Components will be added to `src/components/ui/`.

## Learn More

- [React Documentation](https://react.dev/)
- [TanStack Router](https://tanstack.com/router/latest)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)
- [Vite](https://vitejs.dev/guide/)
