# ModLearn API Server

High-performance backend API for the ModLearn educational content platform.

## Overview

This is the server application that powers ModLearn, providing RESTful APIs and real-time capabilities through oRPC.

## Getting Started

### Prerequisites

- Bun 1.3+
- PostgreSQL database (local or Docker)

### Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# At minimum, verify DATABASE_URL and BETTER_AUTH_SECRET are set correctly
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
