# Getting Started with HabitCraft

Quick start guide for running HabitCraft locally.

> **Live Demo:** https://www.habitcraft.org/
>
> For production deployment, see [AWS Architecture Guide](docs/AWS_ARCHITECTURE.md).

## Quick Start

### Running with Docker (Recommended)

The easiest way to run HabitCraft is with Docker Compose, which starts all required services:

```bash
# From the project root

# First time setup: copy the dev override file
cp docker-compose.override.yml.example docker-compose.override.yml

# Start services
docker-compose up postgres backend-node frontend-nextjs

# Access the application:
# - Frontend: http://localhost:3100
# - Backend API: http://localhost:3000
# - Database Admin (Adminer): http://localhost:8080
```

**Stopping the services:**

```bash
# Stop and remove containers
docker-compose down

# Or stop without removing (can restart with docker-compose start)
docker-compose stop

# Stop and remove volumes (resets database data)
docker-compose down -v
```

**Demo User Credentials:**
- Email: `demo@example.com`
- Password: `demo123`

Login at http://localhost:3100/login to start tracking habits!

### Manual Development Setup

For local development without Docker, see the individual setup guides:
- **[Backend Setup](backends/node/README.md)** - Node.js + Express backend
- **[Frontend Setup](frontends/nextjs/README.md)** - Next.js frontend

Note: You'll need to run PostgreSQL, backend, and frontend simultaneously for the application to work.

## Project Structure

```
habittracker_fullstack/
├── backends/node/        # Node.js + Express backend
├── frontends/nextjs/     # Next.js frontend
├── shared/               # Shared resources
│   ├── api-spec/         # OpenAPI specification
│   ├── database/         # PostgreSQL schema and migrations
│   └── types/            # Shared type definitions
├── docker-compose.yml    # Docker orchestration
├── PROJECT_PLAN.md       # Detailed development roadmap
├── GETTING_STARTED.md    # Quick start guide (this file)
├── AUTHENTICATION.md     # JWT authentication guide
└── README.md             # Project overview
```

## Setup Steps

### 1. Set Up Environment Variables

```bash
# Copy the example env file
cp .env.example .env

# Edit .env and update with your values (especially JWT_SECRET)
```

### 2. Set Up Database

Using Docker (recommended):

```bash
# Start just the database
docker-compose up postgres

# Or start it in the background
docker-compose up -d postgres
```

The database includes:

- Schema with users, habits, and completions tables
- Seed data with demo users and sample habits
- Adminer web UI at http://localhost:8080
  - System login: habituser / habitpass / habitcraft
  - Demo User 1: `demo@example.com` / `demo123` (ID: `123e4567-e89b-12d3-a456-426614174000`)
  - Demo User 2: `demo2@example.com` / `demo1234` (ID: `223e4567-e89b-12d3-a456-426614174001`)

Manual setup:

```bash
# Create database
createdb habitcraft

# Run schema
psql -d habitcraft -f shared/database/schema.sql
```

## Current Features

### Backend (Node.js + Express)

- User registration and login with JWT authentication
- Secure token management (access + refresh tokens via HttpOnly cookies)
- Full habit CRUD operations (Create, Read, Update, Delete)
- Completion tracking (mark complete, view history, remove)
- User data isolation and authorization
- CORS support with credentials
- PostgreSQL database with connection pooling

### Frontend (Next.js + React)

- User registration and login pages
- JWT-based authentication with automatic token refresh
- Protected routes requiring authentication
- Habit management UI (create, update, delete)
- Calendar week view with completion tracking
- Week navigation (previous/next)
- Optimistic UI updates
- Fully connected to backend API

## What's Next

See [PROJECT_PLAN.md](PROJECT_PLAN.md) for the complete development roadmap and current status.

## Useful Commands

### Database Management

```bash
# Access database with psql
psql postgresql://habituser:habitpass@localhost:5432/habitcraft

# View schema
psql postgresql://habituser:habitpass@localhost:5432/habitcraft -c "\dt"

# Use Adminer (web UI)
docker-compose up adminer
# Then visit http://localhost:8080
```

### Managing npm Dependencies with Docker

When adding new npm packages while using Docker, the containers need to be updated to pick up the changes. Follow these steps:

**Option 1: Rebuild containers (recommended for new dependencies)**

```bash
# 1. Stop the running containers
docker-compose down

# 2. Install the package locally (updates package.json and package-lock.json)
cd backends/node
npm install <package-name>

# 3. Rebuild and restart containers
cd ../..
docker-compose up --build postgres backend-node frontend-nextjs
```

**Option 2: Install directly in container (quick testing)**

```bash
# Install package inside the running container
docker-compose exec backend-node npm install <package-name>

# Note: This is temporary - package.json on host won't be updated
# For permanent changes, use Option 1
```

**Troubleshooting unhealthy containers:**

```bash
# Check container health status
docker-compose ps

# View container logs for errors
docker-compose logs backend-node

# Force rebuild without cache
docker-compose build --no-cache backend-node
docker-compose up -d backend-node
```

### Running Tests

```bash
# Node.js backend unit tests
cd backends/node
npm test

# Run specific test file
npm test -- routes/auth.test.js
npm test -- routes/habits.test.js
npm test -- routes/completions.test.js

# Next.js frontend
cd frontends/nextjs
npm test

# Run specific test file
npm test -- lib/api.test.ts
npm test -- hooks/useHabits.test.ts
```

### Running Integration Tests

Integration tests run against a real test database:

```bash
# Start the test database (from project root)
./scripts/test-db-start.sh

# Run backend integration tests
cd backends/node
npm run test:integration

# Stop the test database when done
./scripts/test-db-stop.sh
```

### API Documentation

The OpenAPI specification is available at:

- File: `shared/api-spec/openapi.yaml`
- View online: Use [Swagger Editor](https://editor.swagger.io/) and paste the file contents

## Documentation

- **[PROJECT_PLAN.md](PROJECT_PLAN.md)** - Complete development roadmap and task list
- **[AUTHENTICATION.md](AUTHENTICATION.md)** - JWT authentication implementation guide
- **[AWS Architecture](docs/AWS_ARCHITECTURE.md)** - Production deployment guide (Lightsail + RDS)
- **[README.md](README.md)** - Project overview
- **[backends/node/README.md](backends/node/README.md)** - Backend setup and API reference
- **[shared/api-spec/openapi.yaml](shared/api-spec/openapi.yaml)** - OpenAPI specification

## Common Issues

### Port Already in Use

If you get "port already in use" errors:

```bash
# Change ports in docker-compose.yml or use different ports
# For example, change "3000:3000" to "3001:3000"
```

### Database Connection Issues

```bash
# Make sure PostgreSQL is running
docker-compose ps

# Check database logs
docker-compose logs postgres

# Verify connection
psql postgresql://habituser:habitpass@localhost:5432/habitcraft -c "SELECT 1"
```

### CORS Issues (Frontend Can't Access Backend)

If the frontend shows connection issues or CORS errors:

```bash
# 1. Verify backend has CORS enabled with credentials
curl -i http://localhost:3000/hello | grep "Access-Control"
# Should show CORS headers

# 2. Check browser console for CORS errors
# Open DevTools (F12) → Console tab
# Look for "CORS policy" or "credentials" errors

# 3. Verify backend is accessible
curl http://localhost:3000/hello
# Should return: {"message":"Hello World!"}

# 4. If CORS issues persist, restart backend
docker-compose restart backend-node
```

### Working with Demo Users

The database is automatically seeded with two demo users on first startup:

**Demo User 1:**
- Email: `demo@example.com`
- Password: `demo123`
- Sample Habits: 3 pre-created habits

**Demo User 2:**
- Email: `demo2@example.com`
- Password: `demo1234`
- Sample Habits: 3 pre-created habits (Learn Spanish, Drink Water, Journal Writing)

To test the application:

1. Start the services with Docker: `docker-compose up postgres backend-node frontend-nextjs`
2. Open http://localhost:3100/login
3. Login with either demo user credentials
4. Start tracking your habits!

The application uses JWT authentication with HttpOnly cookies for secure token management.

---

For detailed development plans and roadmap, see [PROJECT_PLAN.md](PROJECT_PLAN.md).
