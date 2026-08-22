# Getting Started with HabitCraft

Quick start guide for running HabitCraft locally.

> **Live Application:** https://www.habitcraft.org/
>
> For production deployment, see [GCP Architecture Guide](docs/GCP_ARCHITECTURE.md).

## Quick Start

### Running with Docker (Recommended)

The easiest way to run HabitCraft is with Docker Compose, which starts all required services:

```bash
# From the project root

# First time setup: copy the dev override file
cp docker-compose.override.yml.example docker-compose.override.yml

# Start services
docker-compose up postgres backend frontend

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

**Seed the database** (one-off, after the services are up):

```bash
docker compose --profile seed run --rm db-seed
```

**Test User Credentials:**
- Email: `test@example.com`
- Password: `Test1234!`

Login at http://localhost:3100/login to start tracking habits!

### Docker Troubleshooting

**`npm run dev` fails in a container / dev tooling is missing.** Dev and
production use different images. The dev compose files build
`backend/Dockerfile.dev` and `frontend/Dockerfile.dev`, which run a plain
`npm ci` and therefore include devDependencies (`nodemon`, `next`). The
production `Dockerfile` runs `npm ci --omit=dev`, so it has no dev tooling and
cannot run `npm run dev`. If you see a missing-binary error, check which
`dockerfile:` the service resolved to — `docker-compose.override.yml` is what
selects the dev images, and it is not committed (copy it from
`docker-compose.override.yml.example`).

**Dependency changes do not take effect.** `node_modules` lives in a named
volume (`backend_node_modules`), which persists across `docker-compose down`
and will happily shadow a rebuilt image with stale packages. `down -v` clears
it along with the database; to drop just the dependency cache:

```bash
docker volume rm habitcraft_backend_node_modules
```

Then rebuild. Re-seed afterwards only if you also removed the database volume.

### Manual Development Setup

For local development without Docker, see the individual setup guides:
- **[Backend Setup](backend/README.md)** - Node.js + Express backend
- **[Frontend Setup](frontend/README.md)** - Next.js frontend

Note: You'll need to run PostgreSQL, backend, and frontend simultaneously for the application to work.

## Project Structure

```
habittracker_fullstack/
├── backend/              # Node.js + Express backend
├── frontend/             # Next.js frontend
├── mobile/               # React Native (Expo) mobile app
├── db/                   # dbmate SQL migrations
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
- Seed data with test users and sample habits (loaded on demand, see above)
- Adminer web UI at http://localhost:8080
  - System login: habituser / habitpass / habitcraft
  - Test User 1: `test@example.com` / `Test1234!` (ID: `11111111-1111-1111-1111-111111111111`)
  - Test User 2: `test2@example.com` / `Test1234!` (ID: `22222222-2222-2222-2222-222222222222`)

Manual setup:

```bash
# Create database
createdb habitcraft

# Apply the migrations -- db/migrations/ is the source of truth, and dbmate
# records what it applied in schema_migrations. Do NOT load db/schema.sql
# instead: it is a generated dump and leaves dbmate with no record, so the
# next `dbmate up` would try to re-apply everything.
export DATABASE_URL="postgresql://habituser:habitpass@localhost:5432/habitcraft?sslmode=disable"
dbmate up
```

## Current Features

### Backend (Node.js + Express)

- User registration and login with JWT authentication
- Secure token management (access + refresh tokens via HttpOnly cookies)
- User profile management (update name, email)
- Full habit CRUD operations (Create, Read, Update, Delete)
- Completion tracking (mark complete, add notes, view history, remove)
- User data isolation and authorization
- CORS support with credentials
- PostgreSQL database with connection pooling

### Frontend (Next.js + React)

- User registration and login pages
- JWT-based authentication with automatic token refresh
- Protected routes requiring authentication
- User profile management modal (edit name, email)
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
cd backend
npm install <package-name>

# 3. Rebuild and restart containers
cd ../..
docker-compose up --build postgres backend frontend
```

**Option 2: Install directly in container (quick testing)**

```bash
# Install package inside the running container
docker-compose exec backend npm install <package-name>

# Note: This is temporary - package.json on host won't be updated
# For permanent changes, use Option 1
```

**Troubleshooting unhealthy containers:**

```bash
# Check container health status
docker-compose ps

# View container logs for errors
docker-compose logs backend

# Force rebuild without cache
docker-compose build --no-cache backend
docker-compose up -d backend
```

### Running Tests

```bash
# Node.js backend unit tests
cd backend
npm test

# Run specific test file
npm test -- routes/auth.test.js
npm test -- routes/habits.test.js
npm test -- routes/completions.test.js

# Next.js frontend
cd frontend
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
cd backend
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
- **[GCP Architecture](docs/GCP_ARCHITECTURE.md)** - Production deployment guide (Cloud Run + Cloud SQL)
- **[README.md](README.md)** - Project overview
- **[backend/README.md](backend/README.md)** - Backend setup and API reference
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
docker-compose restart backend
```

### Working with Test Users

Seeding is **not** automatic — run `docker compose --profile seed run --rm db-seed` once after
the services are up. This loads `shared/database/test-fixtures.sql`, the same fixtures CI uses:

**Test User 1:**
- Email: `test@example.com`
- Password: `Test1234!`
- Sample Habits: Morning Exercise, Read Books, plus one archived habit

**Test User 2:**
- Email: `test2@example.com`
- Password: `Test1234!`
- Sample Habits: one habit, used for verifying user isolation

To test the application:

1. Start the services with Docker: `docker-compose up postgres backend frontend`
2. Seed the database: `docker compose --profile seed run --rm db-seed`
3. Open http://localhost:3100/login
4. Login with either test user's credentials
5. Start tracking your habits!

The application uses JWT authentication with HttpOnly cookies for secure token management.

---

For detailed development plans and roadmap, see [PROJECT_PLAN.md](PROJECT_PLAN.md).
