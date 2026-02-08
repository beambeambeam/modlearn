# ModLearn

<div align="center">

**CPE241 Database Systems - Final Project**

## 🎓 About

**ModLearn** is a capstone project for CPE241 Database Systems course. It demonstrates practical application of database design principles, modern web development practices, and full-stack architecture patterns.

## 🛠 Tech Stack

```
Frontend:     React 19 + TanStack Router + Vite
Backend:      Elysia (Bun runtime) + tRPC
Database:     PostgreSQL + Drizzle ORM
Auth:         Better Auth
Styling:      Tailwind CSS + shadcn/ui
Monorepo:     Turborepo + Bun workspaces
Quality:      TypeScript + Biome + Ultracite
```

---

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

| Requirement | Version | Installation |
|------------|---------|--------------|
| **Bun** | 1.3.5+ | `curl -fsSL https://bun.sh/install \| bash` |
| **Docker** | 20.10+ | [Docker Desktop](https://www.docker.com/products/docker-desktop) |
| **Git** | 2.30+ | Usually pre-installed |

> **Note:** Docker is recommended for local PostgreSQL database, but you can use an existing PostgreSQL instance if preferred.

---

## 🚀 Quick Start

For experienced developers who know the stack:

```bash
# 1. Clone the repository
git clone <repository-url>
cd modlearn

# 2. Install dependencies
bun install

# 3. Start PostgreSQL (Docker)
bun run db:start

# 4. Set up environment
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env

# 5. Push database schema
bun run db:push

# 6. Start development servers
bun run dev
```

Visit:
- **Web App**: http://localhost:3001
- **API**: http://localhost:3000

---

## 📖 Detailed Setup

### Step 1: Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd modlearn

# Install all dependencies across workspaces
bun install
```

### Step 2: Database Setup (Choose One)

#### Option A: Docker (Recommended for Beginners)

```bash
# Start PostgreSQL in Docker
bun run db:start

# Verify it's running
bun run db:studio
```

#### Option B: Existing PostgreSQL

If you have PostgreSQL already running:

1. Create a database named `modlearn`
2. Update `apps/server/.env` with your connection string:
   ```bash
   DATABASE_URL=postgresql://user:password@localhost:5432/modlearn
   ```

### Step 3: Environment Configuration

```bash
# Copy environment templates
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env

# Edit files as needed (see Environment Variables section below)
```

### Step 4: Database Schema

```bash
# Push schema to database
bun run db:push

# Optional: Open database studio to inspect
bun run db:studio
```

### Step 5: Run the Application

```bash
# Start all services (web + server)
bun run dev
```

The application will be available at:
- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000

---

## 🔧 Development Workflows

### Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start all apps in development mode |
| `bun run dev:web` | Start only the web frontend |
| `bun run dev:server` | Start only the backend server |
| `bun run build` | Build all apps for production |
| `bun run check-types` | Check TypeScript types across all packages |

### Database Commands

| Command | Description |
|---------|-------------|
| `bun run db:start` | Start PostgreSQL Docker container |
| `bun run db:stop` | Stop PostgreSQL Docker container |
| `bun run db:down` | Remove PostgreSQL Docker container |
| `bun run db:push` | Push schema changes to database |
| `bun run db:generate` | Generate Drizzle ORM types |
| `bun run db:migrate` | Run database migrations |
| `bun run db:studio` | Open Drizzle Studio (GUI for database) |

### Code Quality

| Command | Description |
|---------|-------------|
| `bun run check` | Run linting and formatting checks |
| `bun run fix` | Auto-fix linting and formatting issues |
| `bun run prepare` | Install Git hooks (run once after clone) |

---

## 📁 Project Structure

```
modlearn/
├── apps/
│   ├── web/                 # Frontend application
│   │   ├── src/
│   │   │   ├── components/  # React components
│   │   │   ├── routes/      # TanStack Router routes
│   │   │   ├── lib/         # Utility functions
│   │   │   └── utils/       # tRPC client setup
│   │   ├── .env.example     # Frontend environment template
│   │   └── package.json
│   │
│   └── server/              # Backend API
│       ├── src/
│       │   ├── index.ts     # Elysia server entry
│       │   └── ...          # API routes & logic
│       ├── .env.example     # Backend environment template
│       └── package.json
│
├── packages/
│   ├── api/                 # Shared tRPC routers & types
│   ├── auth/                # Better Auth configuration
│   ├── db/                  # Database schema & queries
│   ├── env/                 # Environment validation
│   └── config/              # Shared TypeScript configs
│
├── package.json             # Root package with scripts
├── turbo.json               # Turborepo configuration
├── biome.json               # Code formatting/linting config
└── bts.jsonc                # Better-T-Stack configuration
```

---

## 🔐 Environment Variables

### Backend (`apps/server/.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/modlearn` |
| `BETTER_AUTH_SECRET` | Secret key for auth encryption | `your-random-secret-key` |
| `BETTER_AUTH_URL` | Auth service URL | `http://localhost:3000` |
| `CORS_ORIGIN` | Allowed frontend origin | `http://localhost:3001` |

### Frontend (`apps/web/.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SERVER_URL` | Backend API URL | `http://localhost:3000` |
