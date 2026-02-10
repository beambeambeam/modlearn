# ModLearn

**CPE241 Database Systems - Final Project**

## About

**ModLearn** is a capstone project for CPE241 Database Systems course.

---

## Prerequisites

Before you begin, ensure you have the following installed:

| Requirement | Version | Installation |
|------------|---------|--------------|
| **Bun** | 1.3.5+ | `curl -fsSL https://bun.sh/install \| bash` |
| **Docker** | 20.10+ | [Docker Desktop](https://www.docker.com/products/docker-desktop) |
| **Git** | 2.30+ | Usually pre-installed |

> **Note:** Docker is recommended for local PostgreSQL database, but you can use an existing PostgreSQL instance if preferred.

---

## Quick Start

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
