# ModLearn

**CPE241 Database Systems - Final Project**

## About

**ModLearn** is a capstone project for CPE241 Database Systems course.

---

## Prerequisites

Before you begin, ensure you have the following installed:

- Bun
- Docker

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
