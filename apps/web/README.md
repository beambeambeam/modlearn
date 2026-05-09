# ModLearn Web Frontend

React-based frontend application for the ModLearn educational video streaming platform.

## Overview

This is the web client for ModLearn, built with modern React patterns and optimized for performance.

## Getting Started

### Prerequisites

- Node.js 18+ or Bun 1.3+
- Backend server running (see `apps/server/`)

### Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# At minimum, verify VITE_SERVER_URL matches your server URL
```

### Development

```bash
# Start the development server
bun run dev

# Or from root
bun run dev:web
```
